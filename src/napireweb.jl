module web
    import Base64
    import HTTP
    import JSON
    import Serialization
    import Sockets

    import napire

    function query(query_dict = nothing; data_url = "false")
        data = __load_graph(query_dict, "false")

        evidence = Dict{Symbol, Bool}()
        results = Dict{Symbol, Float64}()

        if query_dict != nothing
            inference_method = string(get(query_dict, "inference_method", ""))
            query = inference_method == "" ? [] : Set(Symbol(q) for q in get(query_dict, "query"))
            evidence = Dict{Symbol, Bool}( Symbol(kv.first) => convert(Bool, kv.second) for kv in get(query_dict, "evidence", Dict()))

            if length(query) > 0
                try
                    bn = napire.bayesian_train(data)
                    results = napire.predict(bn, query, evidence, inference_method)
                catch e
                    if isa(e, ArgumentError)
                        throw(WebApplicationException(400, e.msg))
                    end

                    rethrow(e)
                end
            end
        end

        data = napire.plot_prediction(data, evidence, results, napire.graphviz.png)
        if parse(Bool, data_url)
            return "data:image/png;base64," * Base64.base64encode(data)
        else
            return data
        end
    end

    function items(query_dict; all_items = "false")
        return __load_graph(query_dict, all_items).items
    end

    function descriptions(query_dict; all_items = "false")
        return __load_graph(query_dict, all_items).descriptions
    end

    function __load_graph(query_dict, all_items)
        connect = get(query_dict, "connect", [])
        connect = length(connect) == 0 ? Array{Tuple{Symbol, Symbol, UInt}, 1}() :
                [ ( Symbol(c[1]),  Symbol(c[2]), convert(UInt, c[3]) ) for c in connect ]

        nodes = get(query_dict, "nodes", Dict())
        nodes = length(nodes) == 0 ? Dict{Symbol, UInt}() :
                Dict(Symbol(key) => convert(UInt, value) for (key, value) in nodes)

        return napire.load(nodes, connect; summary = false, all_items = parse(Bool, all_items))
    end

    function inference()
        d = string(napire.default_inference_method)
        inference_methods = [ d ]
        append!(inference_methods, sort([ k for k in keys(napire.inference_methods) if k != d ]))

        return inference_methods
    end

    started_validations = nothing
    function load_started_validations()
        global started_validations
        if started_validations == nothing
            files = sort([ f for f in readdir(RESULT_DIRECTORY) if occursin(r"^[0-9]+\.ser$", f) ])
            started_validations = [ Serialization.deserialize(joinpath(RESULT_DIRECTORY, f)) for f in files ]
        end
    end


    function validate(query_dict)
        load_started_validations()

        data = __load_graph(query_dict, "false")

        inference_method = string(get(query_dict, "inference_method", napire.default_inference_method))
        subsample_size = parse(Int, query_dict["subsample_size"])
        iterations = parse(Int, query_dict["iterations"])
        query = Set{Symbol}(Symbol(ov) for ov in get(query_dict, "query", []))

        query_dict["inference_method"] = inference_method
        query_dict["subsample_size"] = subsample_size
        query_dict["iterations"] = iterations
        query_dict["query"] = query

        progress_array, task = napire.validate(data, query, subsample_size, iterations, inference_method)
        push!(started_validations, (query_dict, progress_array, task))
        storage_file = joinpath(RESULT_DIRECTORY, string(length(started_validations)) * ".ser")

        @async begin
            data = (query_dict, [ sum (progress_array) ], fetch(task))
            Serialization.serialize(storage_file, data)
        end

    end

    function validations()
        load_started_validations()
        return [ Dict(
            "query" => q,
            "steps_done" => sum(a),
            "steps_total" => q["subsample_size"] * q["iterations"] * napire.ANSWERS_PER_SUBJECT,
            "result" => isa(r, Task) ? (istaskdone(r) ? fetch(r) : nothing) : r;
            ) for (q, a, r) in started_validations ]
    end

    const APISPEC = Dict{NamedTuple, NamedTuple}(
        (path = "/inference", method = "GET") => (fn = inference, content = "application/json"),
        (path = "/descriptions", method = "POST") => (fn = descriptions, content = "application/json"),
        (path = "/items", method = "POST")  => (fn = items, content = "application/json"),
        (path = "/query", method = "POST") => (fn = query, content = "image/png"),
        (path = "/validate", method = "POST")  => (fn = validate, content = "application/json"),
        (path = "/validations", method = "GET")  => (fn = validations, content = "application/json")
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
        r"^.*\.html$" => "text/html"
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

    RESULT_DIRECTORY = nothing
    function start(webdir::String, resultdir::String)
        global RESULT_DIRECTORY = resultdir
        mkpath(resultdir)

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
