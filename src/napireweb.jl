module web
    import HTTP
    import JSON
    import Sockets

    import napire

    function query(query_dict = nothing;
        connect = "", min_weight = "", inference_method = string(napire.default_inference_method))

        data = __load_graph(connect, min_weight)

        evidence = Dict{Symbol, Bool}()
        results = Dict{Symbol, Float64}()
        if query_dict != nothing
            query = Set(Symbol(q) for q in get(query_dict, "query", []))
            evidence = Dict( Symbol(kv.first) => convert(Bool, kv.second) for kv in get(query_dict, "evidence", Dict()))

            bn = napire.bayesian_train(data)

            if length(query) > 0
                try
                    results = napire.predict(bn, query, evidence, inference_method)
                catch e
                    if isa(e, ArgumentError)
                        throw(WebApplicationException(400, e.msg))
                    end

                    rethrow(e)
                end
            end
        end

        return napire.plot_prediction(data, evidence, results, napire.graphviz.png)
    end

    function items(; connect = "", min_weight = "")
        return __load_graph(connect, min_weight).items
    end

    function __load_graph(connect, min_weight)
        if length(connect) == 0
            connect = "CAUSES_CODE/PROBLEMS_CODE"
        end

        if length(min_weight) == 0
            min_weight = "5"
        end

        connect = split(connect, ",")
        connect = [ split(c, "/") for c in connect ]
        connect = [ ( Symbol(c[1]) => Symbol(c[2]) ) for c in connect ]
        min_weight = parse(UInt, min_weight)
        return napire.load(connect; minimum_edge_weight = min_weight, summary = false)
    end

    function inference()
        return keys(napire.inference_methods)
    end

    const APISPEC = Dict{NamedTuple, NamedTuple}(
        (path = "/query", method = "GET")  => (fn = query, content = "image/png"),
        (path = "/query", method = "POST") => (fn = query, content = "image/png"),
        (path = "/items", method = "GET")  => (fn = items, content = "application/json"),
        (path = "/inference", method = "GET") => (fn = inference, content = "application/json")
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
                throw(WebApplicationException(400, "Unparsable body\n\n" * e.msg))
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
                throw(WebApplicationException(400, "Bad query parameters"))
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

        ep = (fn = (; ) -> read(file), content = final_mime)
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

    function start(webdir::String)
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
