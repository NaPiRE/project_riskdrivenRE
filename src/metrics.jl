module Metrics
    function __foreach(data, count_fun_configs, count_fun_numerator, count_fun_denominator = (e, p, c) -> length(e))
        values = []
        for config in count_fun_configs
            total = 0
            main_counter = 0.0
            baseline_counter = 0.0
            for iteration_data in data
                for (expected, predicted, baseline_predicted) in iteration_data
                    total += count_fun_denominator(expected, predicted, config)

                    main_counter       += count_fun_numerator(expected, predicted, config)
                    baseline_counter   += count_fun_numerator(expected, baseline_predicted, config)
                end
            end
            push!(values, (config = config, value = main_counter / total, baseline = baseline_counter / total))
        end

        return values
    end

    function brier_score(data)
        bs = __foreach(data, [ nothing ], ( e, p, c ) -> sum([ (convert(Int, e[s]) - p[s])^2 for s in keys(e) ]))
        return (limits = [ 0, 1 ], data = [ bs[1] ])
    end

    function ranking(data, config = [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ])
        data = __foreach(data, config,
            function(expected, predicted, c)
                predicted_highest = sort(collect(predicted), by = ex -> -ex[2])
                return c <= length(predicted_highest) ? (sum(convert(Int64, expected[k]) for (k, _) in predicted_highest[1:c]) / c)  : missing
            end,
            (e, p, t) -> 1)

        return (limits = [ 0, 1 ], data_xlabel = "Considered elements at the top of the list", data = data)
    end

    function binary_accuracy(data, config = [ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9 ])
        data = __foreach(data, config, (e, p, t) -> length([ s for s in keys(e) if e[s] == (p[s] > t) ]) )
        return (limits = [ 0, 1 ], data_xlabel = "Node-present threshold", data = data)
    end

    function recall(data, config = [ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9 ])
        data = __foreach(data, config,
                (e, p, t) -> sum([ p[s] > t ? 1 : 0 for s in keys(e) if e[s] ]),
                (e, p, t) -> sum([ convert(Int, v) for v in values(e) ]))
        return (limits = [ 0, 1 ], data_xlabel = "Node-present threshold", data = data)
    end

    function precision(data, config = [ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9 ])
        data = __foreach(data, config,
                (e, p, t) -> sum( [ convert(Int, e[s]) for s in keys(p) if p[s] > t ] ),
                (e, p, t) -> sum([ 1 for s in keys(p) if p[s] > t ]))
        return (limits = [ 0, 1 ], data_xlabel = "Node-present threshold",
                    data = data)
    end
end
