module napire

    using DataFrames
    using Printf

    import BayesNets
    import Distributed
    import Random

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
    const models = Dict(string(:bayesnet) => nothing, string(:independent) => nothing)

    const default_inference_method = inference_methods["BayesNets.GibbsSamplingNodewise"]
    const default_dataset = datasets["napire.DataSets.nap_2014"]
    const default_model = string(:bayesnet)
    const default_baseline_model = string(:independent)

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

    function train(data, model::Val{:bayesnet}, subsample = nothing)
        # extract graph layout
        graph_layout = Tuple(keys(data.edges))
        graph_data = subsample != nothing ? data.data[subsample,:] : data.data

        if size(graph_data, 2) > 0
            # remove completely empty lines, BayesNets does not like them
            graph_data = graph_data[sum(convert(Matrix, graph_data), dims = 2)[:] .> 0, :]
        end

        # add one, BayesNets expects state labelling to be 1-based
        graph_data = DataFrame(colwise(x -> convert(Array{Int64}, x) .+ 1, data.data), names(data.data))

        return BayesNets.fit(BayesNets.DiscreteBayesNet, graph_data, graph_layout)
    end
    export bayesian_train

    function train(data, model::Val{:independent}, subsample = nothing)
        graph_data = subsample != nothing ? data.data[subsample,:] : data.data
        return Dict( k => v for (k, v) in zip(names(graph_data), colwise(x -> sum(x), graph_data) / size(graph_data, 1)) )
    end
    export independent_train

    function predict(model, query::Set{Symbol}, evidence::Dict{Symbol, Bool}, inference_method::String)
        return predict(model, query, evidence, inference_methods[inference_method])
    end

    function predict(independent_model::AbstractDict{Symbol,Float64}, query::Set{Symbol}, evidence::Dict{Symbol, Bool}, inference_method::Type = default_inference_method)
        return Dict(symbol => independent_model[symbol] for symbol in query)
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
            plot_label(n) = shorten ? join([ sn[1] for sn in split(string(n), "_")[1:end-1] if sn != "CODE" ]) * string(n)[end - 2:end] : n

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

    __available_workers = nothing
    __workers_per_task = 3
    __workers_lock = ReentrantLock()

    function __validate_data(data)
        i, si, s, data, output_variables, subsample_size, evidence_variables, zero_is_unknown, inference_method, mod, blmod, progress_array = data

        println(string(si) * " of " * string(subsample_size))
        evidence = Dict{Symbol, Bool}()
        for ev in evidence_variables
            if !zero_is_unknown || data[s, ev] > 0
                evidence[ev] = data[s, ev]
            end
        end

        expected = Dict{Symbol, Bool}()
        for ov in output_variables
            expected[ov] = data[s, ov]
        end

        prediction = predict(mod, output_variables, evidence, inference_method)
        baseline_prediction = predict(blmod, output_variables, evidence, inference_method)
        if progress_array != nothing
            progress_array[i, si] += 1
        end
        [ (expected, prediction, baseline_prediction) ]
    end

    function validate(data, output_variables::Set{Symbol}, subsample_size::Int, iterations::Int, zero_is_unknown::Bool, inference_method::String,
                model::Symbol = default_model, baseline_model = default_baseline_model, progress_array = nothing, interruptor = [ ])
        return validate(data, output_variables, subsample_size, iterations, zero_is_unknown, inference_methods[inference_method], model, baseline_model, progress_array, interruptor)
    end

    function validate(data, output_variables::Set{Symbol}, subsample_size::Int, iterations::Int, zero_is_unknown::Bool,
            inference_method::Type = default_inference_method, model::Symbol = default_model, baseline_model::Symbol = default_baseline_model, progress_array = nothing, interruptor = [ ])
        global __available_workers

        acquired_workers = []
        while length(acquired_workers) == 0
            sleep(0.1)
            lock(__workers_lock)
            try
                if __available_workers == nothing
                __available_workers = Distributed.workers()
                end

                if length(__available_workers) >= __workers_per_task
                    acquired_workers = __available_workers[1:__workers_per_task]
                    __available_workers = __available_workers[__workers_per_task + 1:end]
                end
            finally
                unlock(__workers_lock)
            end
        end

        pool = Distributed.WorkerPool(acquired_workers)

        pmap_tasks = []
        try
            println(acquired_workers)
            evidence_variables = setdiff(Set{Symbol}(names(data.data)), output_variables)
            for i in 1:iterations
                println("Validation run " * string(i))
                samples = Random.randperm(size(data.data, 1))

                validation_samples = samples[1:subsample_size]
                training_samples   = samples[subsample_size + 1:end]

                @assert length(validation_samples) == subsample_size
                @assert length(validation_samples) + length(training_samples) == nrow(data.data)
                @assert length(intersect(validation_samples, training_samples)) == 0

                @assert min(validation_samples...) > 0
                @assert min(training_samples...)   > 0
                @assert max(validation_samples...) <= nrow(data.data)
                @assert max(training_samples...)   <= nrow(data.data)

                mod = train(data, Val(model), training_samples)
                blmod = train(data, Val(baseline_model), training_samples)

                pt = @async Distributed.pmap(__validate_data, pool,
                    [ (i, si, validation_samples[si], data.data, output_variables, subsample_size, evidence_variables, zero_is_unknown, inference_method, mod, blmod, progress_array)
                        for si in (1:length(validation_samples)) ])
                push!(pmap_tasks, pt)
            end

            while any([ !istaskdone(pt) for pt in pmap_tasks ]) && length(interruptor) == 0
                sleep(1)
            end

            if length(interruptor) > 0
                throw(InterruptException())
            end

            return [ reduce(vcat, fetch(pt)) for pt in pmap_tasks ]
        catch e
            kills = [ worker.config.process  for worker in Distributed.PGRP.workers if in(worker.id, acquired_workers) ]
            for process in kills; kill(process, Base.SIGKILL); end

            rethrow(e)
        finally
            lock(__workers_lock)
            try
                __available_workers = [__available_workers..., acquired_workers...]
            finally
                unlock(__workers_lock)
            end
        end
    end

    function calc_metrics(data = nothing)
        return Dict{String, Any}(n => f(data) for (n, f) in metrics)
    end
end
