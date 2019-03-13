module napireweb
    using JuliaWebAPI

    function apispec() ::Array{APISpec}
        return [
            APISpec(test, true, Dict())
        ]
    end

    function test()
        return "asdf"
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
