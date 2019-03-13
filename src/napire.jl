module napire

    using DataFrames
    using Printf

    import BayesNets
    import CSV
    import Statistics

    include("graphviz.jl")
    include("napireweb.jl")
    export napireweb
    export graphviz

    function load(connect::Array{Pair{Symbol,Symbol}, 1} = [ (:CAUSES_CODE => :PROBLEMS_CODE) ];
                    minimum_edge_weight = 3, filename = "data/napire.csv", summary = true)
        #
        # CSV parsing
        #

        to_col_name = function(secname, number)
            return Symbol("$(String(secname))_$(@sprintf("%02d", number))")
        end

        data = CSV.read(filename; datarow = 1, delim = ';', quotechar = '"');
        data_meta = data[1:4, :]
        data = data[4:end, :]

        current_title = ""
        current_subtitle = ""
        current_framestart = 0
        items = Dict{Symbol, Set{Symbol}}()
        descriptions = Dict{Symbol, Union{Missing, String}}()
        for i in 1:size(data_meta)[2]
            if !ismissing(data_meta[1, i])
                current_title = data_meta[1, i]
                current_subtitle = ""
                current_framestart = i
            end
            if !ismissing(data_meta[2, i])
                current_subtitle = data_meta[2, i]
                current_framestart = i
            end

            secname = "$(current_title)_$(current_subtitle)"

            colname = to_col_name(secname, i - current_framestart)
            rename!(data, names(data)[i] => colname)
            descriptions[colname] = data_meta[3, i]

            if current_subtitle == "CODE" || current_subtitle == "CATEGORIES"
                if current_framestart == i
                    items[Symbol(secname)] = Set{Symbol}()
                end

                data[colname] = .! ismissing.(data[colname])
                push!(items[Symbol(secname)], colname)
            elseif current_subtitle == "FAILURE"
                data[colname] = data[colname] .== "1"
            end
        end

        #
        # data filtering
        #

        # calculate edges and remove those below threshold
        all_nodes::Set{Symbol} = Set{Symbol}()
        all_edges::Dict{Pair{Symbol, Symbol}, Int64} = Dict{Pair{Symbol, Symbol}, Int64}()

        for connect_pair in connect
            nodes, edges= __create_edges(data, items, connect_pair.first, connect_pair.second, minimum_edge_weight)
            all_nodes = union(all_nodes, nodes)
            all_edges = merge(all_edges, edges)
        end

        # remove now unused data from previously created structures
        data = data[:, collect(all_nodes)]

        # remove completely empty lines
        data = data[sum(convert(Matrix, data), dims = 2)[:] .> 0, :]
        for key in keys(items)
            items[key] = intersect(items[key], all_nodes)
        end

        for key in keys(descriptions)
            if !in(key, all_nodes)
                delete!(descriptions, key)
            end
        end

        if summary
            println("Nodes: ", length(all_nodes))
            println("Descriptions: ", length(descriptions))
            println("Edges: ", length(all_edges))
            println("Samples: ", size(data)[1])
        end

        return (data = data, items = items, descriptions = descriptions,
            edges = all_edges, nodes = all_nodes)
    end
    export load

    function __create_edges(data, items, from ::Symbol, to ::Symbol, minimum_edge_weight)
        edges = Dict{Pair{Symbol, Symbol}, Int64}()

        for from_node in items[from]
            for to_node in items[to]
                edges[(from_node => to_node)] = 0

                for i in 1:size(data)[1]
                    if data[i, from_node] && data[i, to_node]
                        edges[(from_node => to_node)] += 1
                    end
                end
            end
        end

        edges = filter((kv) -> kv.second >= minimum_edge_weight, edges)
        nodes = Set{Symbol}()
        for (n1, n2) in keys(edges)
            push!(nodes, n1)
            push!(nodes, n2)
        end

        return nodes, edges
    end

    plot_label(n) = string(n)[1:1] * string(n)[end - 2:end]
    export plot_label

    function plot(data; shape = "ellipse", penwidth_factor = 5, ranksep = 3, label = plot_label, output_type = graphviz.default_output_type)
        graph_layout = data.edges
        graph = graphviz.Dot(keys(graph_layout))

        for node in data.nodes
            graphviz.set(graph, node, graphviz.label, label(node))
            graphviz.set(graph, node, graphviz.shape, shape)
        end

        graphviz.set(graph, graphviz.ranksep, ranksep)

        max_edges = maximum(values(graph_layout))
        average_weight = Statistics.mean(values(graph_layout))
        println("Edges found: $(length(graph_layout)), average weight: $average_weight")

        for ((n1, n2), n_edges) in graph_layout
            edge_weight = n_edges / max_edges
            alpha = @sprintf("%02x", round(edge_weight * 255))

            graphviz.set(graph, (n1 => n2), graphviz.penwidth, edge_weight * penwidth_factor)
            graphviz.set(graph, (n1 => n2), graphviz.color, "#000000$(alpha)")
        end

        graphviz.plot(graph, output_type)
    end
    export plot

    function bayesian_train(data)
        # extract graph layout
        graph_layout = Tuple(keys(data.edges))

        # add one, BayesNets expects state labelling to be 1-based
        graph_data = DataFrame(colwise(x -> convert(Array{Int64}, x) .+ 1, data.data), names(data.data))

        return BayesNets.fit(BayesNets.DiscreteBayesNet, graph_data, graph_layout)
    end
    export bayesian_train

    function predict(bn, query::Symbol, evidence::Dict{Symbol, Int64}, inference_alg::BayesNets.InferenceMethod = BayesNets.BayesNets.GibbsSamplingNodewise())
        predict(bn, Set([ query ]), evidence, inference_alg)
    end

    function predict(bn, query::Set{Symbol}, evidence::Dict{Symbol, Bool}, inference_alg::BayesNets.InferenceMethod = BayesNets.BayesNets.GibbsSamplingNodewise())
        evidence = Dict{Symbol, Any}( kv.first => convert(Int8, kv.second) + 1 for kv in evidence)

        f = BayesNets.infer(inference_alg, bn, collect(query), evidence = evidence)
        results = Dict{Symbol, Float64}()
        for symbol in query
            results[symbol] = sum(f[BayesNets.Assignment(symbol => 2)].potential)
        end

        return results
    end
    export predict

    function plot_prediction(data, evidence, results; half_cell_width = 40, kwargs...)
        function label(node)
            label = """< <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0">"""

            label *= """<TR><TD COLSPAN="2">$(plot_label(node))</TD></TR>"""
            if haskey(results, node)
                false_val = @sprintf("%d", round( (1 - results[node]) * 100))
                true_val = @sprintf("%d", round(results[node] * 100))
                label *= """<TR><TD WIDTH="$half_cell_width">$(false_val)%</TD><TD WIDTH="$half_cell_width">$(true_val)%</TD></TR>"""
            end

            if haskey(evidence, node)
                println(node)

                false_color = evidence[node] ? "white" : "grey"
                true_color = evidence[node] ? "grey" : "white"
                label *= """<TR><TD WIDTH="$half_cell_width" BGCOLOR="$false_color">  </TD><TD WIDTH="$half_cell_width" BGCOLOR="$true_color">  </TD></TR>"""
            end
            label *= "</TABLE>>"
        end

        plot(data; shape = "plaintext", label = label, kwargs...)
    end
    export plot_prediction
end
