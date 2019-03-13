module napireweb
    using JuliaWebAPI
    import napire

    function apispec() ::Array{APISpec}
        return [
            APISpec(show, false, Dict("Content-Type" => "image/png")),
            APISpec(node_types, true, Dict())
        ]
    end

    function show(minimum_edge_weight; connect = "CAUSES_CODE/PROBLEMS_CODE")
        connect = split(connect, ".")
        connect = [ split(c, "/") for c in connect ]
        connect = [ ( Symbol(c[1]) => Symbol(c[2]) ) for c in connect ]
        minimum_edge_weight = parse(UInt, minimum_edge_weight)

        data = napire.load(connect; minimum_edge_weight = minimum_edge_weight, summary = false)
        return napire.plot(data, napire.graphviz.png)
    end

    function node_types()
        return collect(keys(napire.load().items))
    end

    function start()
        transport = InProcTransport(:napireweb)
        responder = APIResponder(transport, JSONMsgFormat())

        fields = fieldnames(APISpec)
        for spec in apispec()
            register(responder, spec.fn; resp_json = spec.resp_json, resp_headers = spec.resp_headers, endpt = split(string(spec.fn), '.')[end])
        end

        task = @async(process(responder))
        invoker = APIInvoker(transport, JSONMsgFormat())
        run_http(invoker, 8888)
    end
    export start
end
