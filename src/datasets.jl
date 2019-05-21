module DataSets

    using DataFrames
    using Printf

    import CSV

    const MAX_RANK = 5

    function __filter(data, items, descriptions,

            nodes::Array{Tuple{Symbol, Bool, UInt}, 1} = Array{Tuple{Symbol, Bool, UInt}, 1}(),
            connect::Array{Tuple{Symbol, Symbol, Bool, UInt}, 1} = Array{Tuple{Symbol, Symbol, Bool, UInt}, 1}(),
            all_items = false)

        #
        # Make sure the data is properly sorted so
        # subjects are identifiable
        #
        sort!(data, (:ID, :RANK) )

        #
        # node-wise filtering
        #
        for (node_type, weighted, min_weight) in nodes
            for node in items[node_type]
                if ((weighted && sum( (data[node] .> 0) .* parse.(UInt, data[:RANK])) < min_weight)
                        || (!weighted && sum(data[node] .> 0) < min_weight))
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

        # merge the lines for each subject
        new_data = DataFrame(Dict(n => Int[] for n in all_nodes))
        current_subject = data[1, :ID]
        current_subject_firstline = 1
        all_nodes_arr =  collect(all_nodes)
        for i in 1:(size(data, 1) + 1)

            lastline = i == (size(data, 1) + 1)
            if lastline || current_subject != data[i, :ID]
                subject_data = data[current_subject_firstline:(i-1), all_nodes_arr]
                subject_line = DataFrame(colwise(x -> [ sum(x) >= 1 ], subject_data), all_nodes_arr)

                for i in current_subject_firstline:(i-1)
                    @assert data[i, :ID] == current_subject
                end

                new_data = vcat(new_data, subject_line)

                current_subject_firstline = i
            end

            if !lastline; current_subject = data[i, :ID]; end
        end

        return (data = new_data, items = items, descriptions = descriptions,
            edges = all_edges, nodes = all_nodes)
    end

    function __join_contextdata!(data, items, descriptions, contextdata, contextdata_columns)
        for (orig, gr, name, desc, trafo) in values(contextdata_columns)
            if !haskey(items, gr); items[gr] = Set{Symbol}(); end

            contextdata[name] = trafo.(contextdata[orig])

            push!(items[gr], name)
            descriptions[name] = desc
        end

        contextdata = contextdata[:, [ :ID,  (c[3] for c in contextdata_columns)... ]]
        println(contextdata)
        return join(data, contextdata, on = :ID)
    end

    function __dummy!(data, column, node_id)
        for sym in values(node_id); data[sym] = falses(size(data, 1)); end

        for (idx, identifier) in enumerate(data[column])
            data[node_id[identifier]][idx] = true
        end
    end

    function __create_edges(data, items, from::Symbol, to::Symbol, weighted::Bool, minimum_edge_weight)
        edges = Dict{Pair{Symbol, Symbol}, Int64}()

        for from_node in items[from]
            for to_node in items[to]
                edges[(from_node => to_node)] = 0

                for i in 1:size(data)[1]
                    if data[i, from_node] .> 0 && data[i, to_node] .> 0
                        edges[(from_node => to_node)] += weighted ? (MAX_RANK - parse(UInt, data[i, :RANK])) : 1;
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

    include("datasets_nap_2014.jl")
    include("datasets_nap_2018.jl")
end
