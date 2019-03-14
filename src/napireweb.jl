module napireweb
    using JuliaWebAPI
    import napire

    function apispec() ::Array{APISpec}
        return [
            APISpec(query, false, Dict("Content-Type" => "image/png")),
            APISpec(items, true, Dict("Content-Type" => "application/json")),
            APISpec(inference, true, Dict("Content-Type" => "application/json"))
        ]
    end

    function query(query = "", evidence_false = "", evidence_true = "";
        connect = "", min_weight = "", inference_method = string(napire.default_inference_method))

        data = __load_graph(connect, min_weight)

        evidence = Dict{Symbol, Bool}()
        results = Dict{Symbol, Float64}()
        if query != ""
            query = Set{Symbol}(Symbol(q) for q in split(query, ","))

            evidence_true = evidence_true == "" ? [] : [ Symbol(e) for e in split(evidence_true, ",") ]
            evidence_false = evidence_false == "" ? [] : [ Symbol(e) for e in split(evidence_false, ",") ]

            for e in evidence_true
                evidence[e] = true
            end
            for e in evidence_false
                evidence[e] = false
            end

            bn = napire.bayesian_train(data)
            results = napire.predict(bn, query, evidence, inference_method)
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
