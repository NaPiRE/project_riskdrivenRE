module web
    import Base64
    import HTTP
    import JSON
    import Serialization
    import SharedArrays
    import Sockets

    import napire

    function query(query_dict = nothing)
        data = __load_graph(query_dict, "false")

        evidence = Dict{Symbol, Bool}()
        results = Dict{Symbol, Float64}()

        if query_dict != nothing
            inference_method = string(get(query_dict, "inference_method", ""))
            query = Set(Symbol(q) for q in get(query_dict, "query", []))
            evidence = Dict{Symbol, Bool}( Symbol(kv.first) => convert(Bool, kv.second) for kv in get(query_dict, "evidence", Dict()))
        end

        if inference_method != "" && length(query) > 0
            try
                bn = napire.bayesian_train(data)
                results = napire.predict(bn, query, evidence, inference_method)
            catch e
                if isa(e, ArgumentError)
                    throw(WebApplicationException(400, e.msg))
                end

                rethrow(e)
            end

            return __run_task(pa -> napire.plot_prediction(data, query, evidence, results, napire.graphviz.png), query_dict, (1, ), "pngdata")
        else
            return "data:image/png;base64," * Base64.base64encode(napire.plot_prediction(data, query, evidence, results, napire.graphviz.png))
        end
    end

    function __load_graph(query_dict, all_items)
        dataset = string(get(query_dict, "dataset", napire.default_dataset))

        nodes_raw = get(query_dict, "nodes", [])
        nodes::Array{Tuple{Symbol,Bool,UInt64}} = [ ( Symbol(n[1]), convert(Bool, n[2]), convert(UInt, n[3]) ) for n in nodes_raw ]

        connect_raw = get(query_dict, "connect", [])
        connect::Array{Tuple{Symbol,Symbol,Bool,UInt64}} = [ ( Symbol(c[1]),  Symbol(c[2]), convert(Bool, c[3]), convert(UInt, c[4]) ) for c in connect_raw ]

        return napire.load(dataset, nodes, connect, parse(Bool, all_items))
    end

    function query_legend()
        return napire.plot_legend(napire.graphviz.png)
    end

    function items(query_dict; all_items = "false")
        return __load_graph(query_dict, all_items).items
    end

    function descriptions(query_dict; all_items = "false")
        return __load_graph(query_dict, all_items).descriptions
    end

    function options(dict, default)
        return () -> begin d = string(default)
            inference_methods = [ d ]
            append!(inference_methods, sort([ k for k in keys(dict) if k != d ]))

            return inference_methods
        end
    end

    STARTED_TASKS = nothing
    RESULT_DIRECTORY = nothing
    function load_started_tasks(result_directory::String)
        global RESULT_DIRECTORY, STARTED_TASKS
        RESULT_DIRECTORY = result_directory
        files = sort([ f for f in readdir(result_directory) if occursin(r"^[0-9]+\.ser$", f) ])
        STARTED_TASKS = Array{Tuple{Dict{String, Any}, AbstractArray, Int64, Any, String}}(undef, 0)
        append!(STARTED_TASKS, [ Serialization.deserialize(joinpath(result_directory, f)) for f in files ])
    end


    function validate(query_dict)
        data = __load_graph(query_dict, "false")

        inference_method = string(get(query_dict, "inference_method", napire.default_inference_method))
        subsample_size = parse(Int, query_dict["subsample_size"])
        iterations = parse(Int, query_dict["iterations"])
        query = Set{Symbol}(Symbol(ov) for ov in get(query_dict, "query", []))

        query_dict["inference_method"] = inference_method
        query_dict["subsample_size"] = subsample_size
        query_dict["iterations"] = iterations
        query_dict["query"] = query

        if length(query) == 0
            throw(WebApplicationException(400, "No query defined"))
        end

        return __run_task(pa -> napire.validate(data, query, subsample_size, iterations, inference_method, pa), query_dict, (iterations, subsample_size), "metrics")
    end

    function __run_task(fun, query_dict, progress_array_shape, postproc = nothing)
        progress_array = SharedArrays.SharedArray{Int}(progress_array_shape)
        task = @async fun(progress_array)

        push!(STARTED_TASKS, (query_dict, progress_array, prod(progress_array_shape), task, postproc))
        storage_file = joinpath(RESULT_DIRECTORY, string(length(STARTED_TASKS)) * ".ser")

        @async begin
            data = (query_dict, [ prod(progress_array_shape) ], prod(progress_array_shape), fetch(task), postproc)
            Serialization.serialize(storage_file, data)
        end

        return length(STARTED_TASKS)
    end

    function tasks(; id = nothing)
        if id == nothing
            return [ Dict(
                    "query" => t[1],
                    "steps_done" => sum(t[2]),
                    "steps_total" => t[3],
                    "done" => isa(t[4], Task) ? istaskdone(t[4]) : true,
                    "data" => nothing,
                    "postproc" => t[5]
                ) for t in STARTED_TASKS ]
        else
            query, steps_done, steps_total, taskresult, postproc = STARTED_TASKS[parse(UInt, id)]

            data = nothing
            if isa(taskresult, Task) && istaskdone(taskresult)
                data = fetch(taskresult)
            elseif !isa(taskresult, Task)
                data = taskresult
            end

            if data != nothing
                if postproc == "metrics"
                    data = napire.calc_metrics(data)
                elseif postproc == "pngdata"
                    data = "data:image/png;base64," * Base64.base64encode(data)
                end
            end

            return Dict(
                    "query" => query,
                    "steps_done" => sum(steps_done),
                    "steps_total" => steps_total,
                    "done" => isa(taskresult, Task) ? istaskdone(taskresult) : true,
                    "data" => data,
                    "postproc" => postproc
                )
        end
    end

    const APISPEC = Dict{NamedTuple, NamedTuple}(
        (path = "/inference", method = "GET") => (fn = options(napire.inference_methods, napire.default_inference_method), content = "application/json"),
        (path = "/datasets", method = "GET") => (fn = options(napire.datasets, napire.default_dataset), content = "application/json"),
        (path = "/descriptions", method = "POST") => (fn = descriptions, content = "application/json"),
        (path = "/items", method = "POST")  => (fn = items, content = "application/json"),
        (path = "/query", method = "POST") => (fn = query, content = "image/png"),
        (path = "/infer", method = "POST") => (fn = query, content = "application/json"),
        (path = "/query_legend", method = "GET") => (fn = query_legend, content="image/png"),
        (path = "/validate", method = "POST")  => (fn = validate, content = "application/json"),
        (path = "/tasks", method = "GET")  => (fn = tasks, content = "application/json")
    )

    const BODYMETHODS = Set([ "POST", "PUT" ])

    const REQUEST_CONVERSION = Dict(
        "application/json" => (b) -> JSON.parse(String(b))
    )

    const RESPONSE_CONVERSION = Dict(
        "application/json" => (b) -> JSON.json(b)
    )

    const EXTENSION_MAP = Dict(
        r"^.*\.json$"  => "application/json",
        r"^.*\.js$"  => "text/javascript",
        r"^.*\.css$" => "text/css",
        r"^.*\.html$" => "text/html",
        r"^.*\.ico$" => "image/x-icon"
    )

    struct WebApplicationException <: Exception
        code::Int64
        msg::String
    end

    function WebApplicationException(code::Int64)
        return WebApplicationException(code, "")
    end

    function dispatch(request::HTTP.Message)
        uri = parse(HTTP.URI, request.target)
        key = (path = uri.path, method = request.method)
        if !haskey(APISPEC, key)
            throw(WebApplicationException(404))
        end
        endpoint = APISPEC[key]

        params = Dict(Symbol(k) => v for (k, v) in HTTP.queryparams(uri))

        body = ""
        if in(key.method, BODYMETHODS)
            content_type = HTTP.header(request, "Content-Type", "")
            if !haskey(REQUEST_CONVERSION, content_type)
                throw(WebApplicationException(400, "Unknown Content-Type"))
            end

            try
                body = REQUEST_CONVERSION[content_type](request.body)
            catch e
                throw(WebApplicationException(400, "Unparsable body: " * e.msg))
            end
        end

        try
            if in(key.method, BODYMETHODS)
                response = endpoint.fn(body; params...)
            else
                response = endpoint.fn(; params...)
            end
        catch e
            if isa(e, ErrorException)
                throw(WebApplicationException(400, "Bad query parameters: " * e.msg))
            end
            rethrow(e)
        end

        if isa(response, HTTP.Response)
            return response
        end

        if haskey(RESPONSE_CONVERSION, endpoint.content)
            response = RESPONSE_CONVERSION[endpoint.content](response)
        end

        return HTTP.Response(response == nothing ? 204 : 200, [ ("Content-Type", endpoint.content) ]; body = response, request = request)
    end

    function respond(request::HTTP.Message)
        try
            return dispatch(request)
        catch e
            if isa(e, WebApplicationException)
                return HTTP.Response(e.code, [ ("Content-Type", "text/plain") ]; body = e.msg, request = request)
            else
                for (exc, bt) in Base.catch_stack()
                   showerror(stdout, exc, bt)
                   println()
                end
                return HTTP.Response(500, [ ("Content-Type", "text/plain") ]; body = string(e), request= request)
            end
        end
    end

    function serve_file(path, file)
        if path[1] != '/'
            path = "/" * path
        end

        final_mime = "application/octet_stream"
        for (regex, mime) in EXTENSION_MAP
            if match(regex, path) != nothing
                final_mime = mime
            end
        end

        ep = (fn = (; kwargs...) -> read(file), content = final_mime)
        APISPEC[(path = "/web" * path, method = "GET")] = ep

        newpath = replace(path, r"/index.html$" => "/")
        if newpath != path
            APISPEC[(path = "/web" * newpath, method = "GET")] = ep # with /
            APISPEC[(path = "/web" * newpath[2:end], method = "GET")] = ep # without /
        end
    end

    function redirect(path, destination)
        APISPEC[(path = path, method = "GET")] = (
            fn = (; ) -> HTTP.Response(301, [ ("Location", destination) ]), content = nothing)
    end

    function start(webdir::String, resultdir::String)
        mkpath(resultdir)
        load_started_tasks(resultdir)

        for (rootpath, dirs, files) in walkdir(webdir; follow_symlinks = false)
            for file in files
                fullpath = joinpath(rootpath, file)
                serve_file(relpath(fullpath, webdir), fullpath)
            end
        end
        redirect("/", "/web")

        start()
    end

    function start()
        println("Starting napire analysis REST service")
        HTTP.serve(respond, Sockets.localhost, 8888)
    end
    export start
end
