module napire

    using DataFrames
    using Printf

    import BayesNets
    import Distributed
    import Random
    import SharedArrays

    include("graphviz.jl")
    export graphviz

    function __analyse_module_content(dict, mod, filter)
        for n in names(mod; all = true)
            if !isdefined(mod, n)
                continue
            end

            f = getfield(mod, n)
            if !startswith(string(n), "__",) && filter(n, f)
                dict[string(mod) * "." * string(n)] = f
            end
        end
        return dict
    end

    include("datasets.jl")
    include("metrics.jl")

    const inference_methods = __analyse_module_content(Dict{String, Type}(), BayesNets,
                    (n, f) -> isa(f, Type) && f != BayesNets.InferenceMethod && f <: BayesNets.InferenceMethod)
    const datasets = __analyse_module_content(Dict{String, Function}(), napire.DataSets,
                    (n, f) -> isa(f, Function) && n != :eval && n != :include)
    const metrics = __analyse_module_content(Dict{String, Function}(), napire.Metrics,
                    (n, f) -> isa(f, Function) && n != :eval && n != :include)

    const default_inference_method = inference_methods["BayesNets.GibbsSamplingNodewise"]
    const default_dataset = datasets["napire.DataSets.load_2014"]

    export inference_methods, datasets, metrics, default_inference_method, default_dataset

    include("napireweb.jl")
    export napireweb

    function load(dataset, args...; summary = false)
        data = datasets[string(dataset)](args...)

        #
        # summary
        #
        if summary
            println("Nodes: ", length(data.nodes))
            println("Descriptions: ", length(data.descriptions))
            println("Edges: ", length(data.edges))
            println("Samples: ", size(data.data)[1])
        end

        return data
    end

    function plot(data, output_type = graphviz.default_output_type; shape = shape(n) = "ellipse", penwidth_factor = 5, ranksep = 3, label = identity)
        graph_layout = data.edges
        graph = graphviz.Dot(data.nodes, keys(graph_layout))

        for node in data.nodes
            graphviz.set(graph, node, graphviz.label, label(node))
            graphviz.set(graph, node, graphviz.margin, 0)
            graphviz.set(graph, node, graphviz.shape, shape(node))
        end

        graphviz.set(graph, graphviz.ranksep, ranksep)

        max_edges = isempty(graph_layout) ? 0 : maximum(values(graph_layout))

        for ((n1, n2), n_edges) in graph_layout
            edge_weight = n_edges / max_edges
            alpha = @sprintf("%02x", round(edge_weight * 255))

            graphviz.set(graph, (n1 => n2), graphviz.penwidth, edge_weight * penwidth_factor)
            graphviz.set(graph, (n1 => n2), graphviz.color, "#000000$(alpha)")
        end

        graphviz.plot(graph, output_type)
    end
    export plot

    function bayesian_train(data, subsample = nothing)
        # extract graph layout
        graph_layout = Tuple(keys(data.edges))

        graph_data = data.data
        if subsample != nothing
            graph_data = graph_data[subsample,:]
        end

        if size(graph_data, 2) > 0
            # remove completely empty lines, BayesNets does not like them
            graph_data = graph_data[sum(convert(Matrix, graph_data), dims = 2)[:] .> 0, :]
        end

        # add one, BayesNets expects state labelling to be 1-based
        graph_data = DataFrame(colwise(x -> convert(Array{Int64}, x) .+ 1, data.data), names(data.data))

        return BayesNets.fit(BayesNets.DiscreteBayesNet, graph_data, graph_layout)
    end
    export bayesian_train

    function predict(bn::BayesNets.DiscreteBayesNet, query::Set{Symbol}, evidence::Dict{Symbol, Bool}, inference_method::String)
        return predict(bn, query, evidence, inference_methods[inference_method])
    end

    function predict(bn::BayesNets.DiscreteBayesNet, query::Set{Symbol}, evidence::Dict{Symbol, Bool}, inference_method::Type = default_inference_method)

        evidence = Dict{Symbol, Any}( kv.first => convert(Int8, kv.second) + 1 for kv in evidence)

        f = BayesNets.infer(inference_method(), bn, collect(query), evidence = evidence)
        results = Dict{Symbol, Float64}()
        for symbol in query
            results[symbol] = sum(f[BayesNets.Assignment(symbol => 2)].potential)
        end

        return results
    end
    export predict

    function plot_prediction(data, query, evidence, results, output_type = graphviz.default_output_type; half_cell_width = 40, shorten = true, kwargs...)
        function label(node)
            plot_label(n) = shorten ? string(n)[1:1] * string(n)[end - 2:end] : n

            if !in(node, query) && !haskey(evidence, node) && !haskey(results, node)
                return plot_label(node)
            end

            padding = (haskey(results, node) || haskey(evidence, node)) ? 1 : 5

            label = """< <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0">"""
            label *= """<TR><TD COLSPAN="2" CELLPADDING="$(padding)">$(plot_label(node))</TD></TR>"""
            if haskey(results, node)
                false_val = @sprintf("%d", round( (1 - results[node]) * 100))
                true_val = @sprintf("%d", round(results[node] * 100))
                label *= """<TR><TD WIDTH="$half_cell_width">$(false_val)%</TD><TD WIDTH="$half_cell_width">$(true_val)%</TD></TR>"""
            end

            if haskey(evidence, node)
                false_color = evidence[node] ? "white" : "grey"
                true_color = evidence[node] ? "grey" : "white"
                label *= """<TR><TD WIDTH="$half_cell_width" BGCOLOR="$false_color">  </TD><TD WIDTH="$half_cell_width" BGCOLOR="$true_color">  </TD></TR>"""
            end
            label *= "</TABLE>>"
        end

        function shape(node)
            if !in(node, query) && !haskey(evidence, node) && !haskey(results, node)
                return "ellipse"
            else
                return "plaintext"
            end
        end

        plot(data, output_type; shape = shape, label = label, kwargs...)
    end
    export plot_prediction

    function plot_legend(output_type = graphviz.default_output_type, kwargs...)
        plot_prediction( ( nodes = [ :unknown, :output, :absent, :present, :result ], edges = Dict{Pair{Symbol, Symbol}, Int}()),
                        Set{Symbol}([:output]), Dict{Symbol, Bool}(:present => true, :absent => false),
                        Dict{Symbol, Float64}( :result => 0.3 ), output_type; shorten = false)
    end
    export plot_legend

    function validate(data, output_variables::Set{Symbol}, subsample_size::Int, iterations::Int, inference_method::String)
        return validate(data, output_variables, subsample_size, iterations, inference_methods[inference_method])
    end

    function validate(data, output_variables::Set{Symbol}, subsample_size::Int, iterations::Int, inference_method::Type = default_inference_method)
        evidence_variables = setdiff(Set{Symbol}(names(data.data)), output_variables)

        progress_array = SharedArrays.SharedArray{Int}( (iterations, subsample_size))
        task = @async begin
            iteration_tasks = []
            for i in 1:iterations
                it_task = @async begin
                    println("Validation run " * string(i))
                    samples = Random.randperm(length(data.subjects)) .- 1

                    validation_samples = samples[1:subsample_size]
                    training_samples   = samples[subsample_size + 1:end]

                    @assert length(validation_samples) == subsample_size
                    @assert length(validation_samples) + length(training_samples) == nrow(data.data)
                    @assert length(intersect(validation_samples, training_samples)) == 0

                    @assert min(validation_samples...) > 0
                    @assert min(training_samples...)   > 0
                    @assert max(validation_samples...) <= nrow(data.data)
                    @assert max(training_samples...)   <= nrow(data.data)

                    bn = bayesian_train(data, training_samples)
                    function __merge_arrays(a1, a2)
                        append!(a1, a2); a1
                    end

                    subtasks = Distributed.@distributed __merge_arrays for si in 1:length(validation_samples)
                        s = validation_samples[si]

                        println(string(si) * " of " * string(subsample_size))
                        evidence = Dict{Symbol, Bool}()
                        for ev in evidence_variables
                            evidence[ev] = data.data[s, ev]
                        end

                        expected = Dict{Symbol, Bool}()
                        for ov in output_variables
                            expected[ov] = data.data[s, ov]
                        end

                        prediction = predict(bn, output_variables, evidence, inference_method)
                        progress_array[i, si] += 1
                        [ (expected, prediction) ]
                    end

                    fetch(subtasks)
                end

                push!(iteration_tasks, it_task)
            end
            [ fetch(it_task) for it_task in iteration_tasks ]
        end

        return progress_array, task
    end

    function calc_metrics(data = nothing)
        return Dict{String, Any}(n => f(data) for (n, f) in metrics)
    end
end
