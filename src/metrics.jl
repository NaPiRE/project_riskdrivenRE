module Metrics
    function brier_score(data)
        bs = 0
        ns = 0
        for iteration_data in data
            for (expected, predicted) in iteration_data
                bs += sum([ (convert(Int, expected[s]) - predicted[s])^2 for s in keys(expected) ])
                ns += length(expected)
            end
        end
        return (limits = [ 0, 1 ], data = [ (nothing, bs / ns) ])
    end

    function ranking(data, config = [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ])
        number = 0
        summation = [ 0.0 for c in config ]

        for iteration_data in data
            for (expected, predicted) in iteration_data
                predicted_highest = sort(collect(predicted), by = ex -> -ex[2])
                summation = summation .+ [ c <= length(predicted_highest) ? (sum(convert(Int64, expected[k]) for (k, _) in predicted_highest[1:c]) / c)  : missing for c in config ]
                number += 1
            end
        end
        summation = summation / number

        return (limits = [ 0, 1 ], data_xlabel = "Considered elements at the top of the list", data = [ (c, (value = summation[c], )) for c in config ])
    end

    function binary_accuracy(data, config = [ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9 ])
        function calc(threshold)
            total = 0
            correct = 0
            for iteration_data in data
                for (expected, predicted) in iteration_data
                    total += length(expected)
                    correct += length([ s for s in keys(expected) if expected[s] == (predicted[s] > threshold) ])
                end
            end

            return (value = correct / total, )
        end

        return (limits = [ 0, 1 ], data_xlabel = "Node-present threshold",
                    data = [ (t, calc(t)) for t in config ])
    end

    function recall(data, config = [ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9 ])
        function calc(threshold)
            to_be_found = 0
            found = 0
            for iteration_data in data
                for (expected, predicted) in iteration_data
                    to_be_found += sum([ convert(Int, v) for v in values(expected) ])
                    found += sum([ predicted[s] > threshold ? 1 : 0 for s in keys(expected) if expected[s] ])
                end
            end
            return (value = found / to_be_found, )
        end

        return (limits = [ 0, 1 ], data_xlabel = "Node-present threshold",
                    data = [ (t, calc(t)) for t in config ])
    end

    function precision(data, config = [ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9 ])
        function calc(threshold)
            positives = 0
            true_positives = 0
            for iteration_data in data
                for (expected, predicted) in iteration_data
                    positives += sum([ 1 for s in keys(predicted) if predicted[s] > threshold ])
                    true_positives += sum( [ convert(Int, expected[s]) for s in keys(predicted) if predicted[s] > threshold ] )
                end
            end
            return (value = true_positives / positives, )
        end

        return (limits = [ 0, 1 ], data_xlabel = "Node-present threshold",
                    data = [ (t, calc(t)) for t in config ])
    end
end
