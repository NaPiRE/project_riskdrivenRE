module napire

    using DataFrames
    using Printf

    import BayesNets
    import CSV
    import Statistics

    include("graphviz.jl")

    function load(minimum_edge_weight = 3, causes_problems_edges = true, problems_effects_edges = true, filename = "data/napire.csv")
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

        if causes_problems_edges
            nodes, edges= __create_edges(data, items, :CAUSES_CODE, :PROBLEMS_CODE, minimum_edge_weight)
            all_nodes = union(all_nodes, nodes)
            all_edges = Dict(setdiff(all_edges, edges))
        end

        if problems_effects_edges
            nodes, edges = __create_edges(data, items, :PROBLEMS_CODE, :EFFECTS_CODE, minimum_edge_weight)
            all_nodes = union(all_nodes, nodes)
            all_edges = Dict(setdiff(all_edges, edges))
        end

        # remove now unused data from previously created structures
        data = data[collect(all_nodes), :]

        # remove completely empty lines
        data = data[sum(convert(Matrix, data), dims = 2)[:] .> 0, :]
        for key in keys(items)
            items[key] = intersect(items[key], all_nodes)
        end
        descriptions = setdiff(descriptions, all_nodes)

        return (data = data, items = items, descriptions = descriptions,
            edges = all_edges, nodes = all_nodes)
    end
    export load

    function __create_edges(data, items, from ::Symbol, to ::Symbol, minimum_edge_weight)
        edges = Dict{Pair{Symbol, Symbol}, Int64}()
        nodes = Set{Symbol}()

        for from_node in items[from]
            for to_node in items[to]
                edges[(from_node => to_node)] = 0

                for i in 1:size(data)[1]
                    if data[i, from_node] && data[i, to_node]
                        push!(nodes, from_node)
                        push!(nodes, to_node)
                        edges[(from_node => to_node)] += 1
                    end
                end
            end
        end

        return nodes, filter((kv) -> kv.second >= minimum_edge_weight, edges)
    end


    function plot(data, penwidth_factor = 5, ranksep = 3)
        graph_layout = merge(data.causes_edges, data.problems_edges)
        graph = graphviz.Dot(keys(graph_layout))

        graphviz.set(graph, graphviz.ranksep, ranksep)

        max_edges = maximum(values(graph_layout))
        average_weight = Statistics.mean(values(graph_layout))
        println("Edges found: $(length(graph_layout)), average weight: $average_weight")

        for ((n1, n2), n_edges) in graph_layout
            edge_weight = n_edges / max_edges
            alpha = @sprintf("%02x", round(edge_weight * 255))
            n1l = string(n1)
            n1l = n1l[1:1] * n1l[end-2:end]
            n2l = string(n2)
            n2l = n2l[1:1] * n2l[end-2:end]

            graphviz.set(graph, n1, graphviz.label, n1l)
            graphviz.set(graph, n2, graphviz.label, n2l)
            graphviz.set(graph, (n1 => n2), graphviz.penwidth, edge_weight * penwidth_factor)
            graphviz.set(graph, (n1 => n2), graphviz.color, "#000000$(alpha)")
        end

        png = graphviz.plot(graph, Val(graphviz.png))
        if isdefined(Main, :IJulia) && Main.IJulia.inited
            display("image/png", png)
        else
           write("napire.png",  png)
        end
    end
    export plot

    function bayesian_train(data)
        # extract graph layout
        graph_layout = data.causes_edges
        graph_layout = Tuple(keys(graph_layout))

        # add one, BayesNets expects state labelling to be 1-based
        graph_data = DataFrame(colwise(x -> convert(Array{Int64}, x) .+ 1, graph_data), names(graph_data))

        return BayesNets.fit(BayesNets.DiscreteBayesNet, graph_data, graph_layout)
    end
    export bayesian_network

    function plot_predict(evidence::Dict{Symbol, Int64}, inference_alg::BayesNets.InferenceMethod = BayesNets.BayesNets.GibbsSamplingNodewise())
        res = convert(DataFrame, BayesNets.infer(inference_alg, bn, collect(problems), evidence = evidence))

    end

end
