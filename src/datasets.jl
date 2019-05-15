module DataSets

    using DataFrames
    using Printf

    import CSV

    const ANSWERS_PER_SUBJECT = 5

    function nap_2014(nodes::Array{Tuple{Symbol, Bool, UInt}, 1} = Array{Tuple{Symbol, Bool, UInt}, 1}(),
            connect::Array{Tuple{Symbol, Symbol, Bool, UInt}, 1} = Array{Tuple{Symbol, Symbol, Bool, UInt}, 1}(), all_items = false)

        filename = joinpath(dirname(@__FILE__), "../data/2014/napire.csv")

        #
        # CSV parsing
        #

        to_col_name = function(secname, number)
            return Symbol("$(String(secname))_$(@sprintf("%02d", number))")
        end

        data = CSV.read(filename; datarow = 1, delim = ';', quotechar = '"');
        data_meta = data[1:4, :]
        data = data[4:end, :]

        current_title = ""
        current_subtitle = ""
        current_framestart = 0
        items = Dict{Symbol, Set{Symbol}}()
        descriptions = Dict{Symbol, Union{Missing, String}}()
        for i in 1:size(data_meta)[2]
            if !ismissing(data_meta[1, i])
                current_title = data_meta[1, i]
                current_subtitle = ""
                current_framestart = i
            end
            if !ismissing(data_meta[2, i])
                current_subtitle = data_meta[2, i]
                current_framestart = i
            end

            secname = "$(current_title)_$(current_subtitle)"

            colname = to_col_name(secname, i - current_framestart)
            rename!(data, names(data)[i] => colname)
            descriptions[colname] = data_meta[3, i]

            if current_subtitle == "CODE" || current_subtitle == "CATEGORIES"
                if current_framestart == i
                    items[Symbol(secname)] = Set{Symbol}()
                end

                data[colname] = .! ismissing.(data[colname])
                push!(items[Symbol(secname)], colname)
            elseif current_subtitle == "FAILURE"
                data[colname] = data[colname] .== "1"
            end
        end

        #
        # Make sure the data is properly sorted so
        # subjects are identifiable before cross-validation
        #
        sort!(data, (:IDENTIFIERS_SUBJECT_00, :IDENTIFIERS_RANK_00) )
        subjects = unique(data[:IDENTIFIERS_SUBJECT_00])
        sort!(subjects)

        #
        # node-wise filtering
        #
        for (node_type, weighted, min_weight) in nodes
            for node in items[node_type]
                if ((weighted && sum(data[node] .* parse.(UInt, data[:IDENTIFIERS_RANK_00])) < min_weight)
                        || (!weighted && sum(data[node]) < min_weight))
                    deletecols!(data, node)
                    delete!(items[node_type], node)
                    delete!(descriptions, node)
                end
            end
        end

        #
        # edge-wise filtering
        #
        all_nodes::Set{Symbol} = Set{Symbol}()
        all_edges::Dict{Pair{Symbol, Symbol}, Int64} = Dict{Pair{Symbol, Symbol}, Int64}()

        for connect_pair in connect
            nodes, edges = __create_edges(data, items, connect_pair[1], connect_pair[2], connect_pair[3], connect_pair[4])
            all_nodes = union(all_nodes, nodes)
            all_edges = merge(all_edges, edges)
        end

        # remove now unused data from previously created structures
        data = data[:, collect(all_nodes)]

        if !all_items
            for key in keys(items)
                items[key] = intersect(items[key], all_nodes)
            end

            for key in keys(descriptions)
                if !in(key, all_nodes)
                    delete!(descriptions, key)
                end
            end
        end

        # merge the five lines for each subject
        new_data = similar(data, 0)
        for i in 1:(size(data, 1) / ANSWERS_PER_SUBJECT)
            rows = collect(StepRange( convert(Int, ((i-1) * ANSWERS_PER_SUBJECT + 1)), 1, convert(Int, (i * ANSWERS_PER_SUBJECT)) ))
            ld = DataFrame(colwise(x -> [ sum(x) >= 1 ], data[rows, :]), names(data))
            new_data = vcat(new_data, ld)
        end
        data = new_data

        return (data = data, items = items, descriptions = descriptions,
            edges = all_edges, nodes = all_nodes, subjects = subjects)
    end
    export load

    function __create_edges(data, items, from::Symbol, to::Symbol, weighted::Bool, minimum_edge_weight)
        edges = Dict{Pair{Symbol, Symbol}, Int64}()

        for from_node in items[from]
            for to_node in items[to]
                edges[(from_node => to_node)] = 0

                for i in 1:size(data)[1]
                    if data[i, from_node] && data[i, to_node]
                        edges[(from_node => to_node)] += weighted ? parse(UInt, data[i, :IDENTIFIERS_RANK_00]) : 1;
                    end
                end
            end
        end

        edges = filter((kv) -> kv.second >= minimum_edge_weight, edges)
        nodes = Set{Symbol}()
        for (n1, n2) in keys(edges)
            push!(nodes, n1)
            push!(nodes, n2)
        end

        return nodes, edges
    end
end
