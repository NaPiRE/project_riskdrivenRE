function nap_2018(args...)
        DATADIR = joinpath(dirname(@__FILE__), "../data/2018/")
        NODE_TYPES =  [:CAUSES_CODE, :PROBLEMS_CODE, :EFFECTS_CODE ]

        node_ids = Dict( nt => Dict{String, Symbol}() for nt in NODE_TYPES)
        descriptions = Dict{Symbol, Union{Missing, String}}()
        items = Dict{Symbol, Set{Symbol}}(nt => Set{Symbol}() for nt in NODE_TYPES)

        data = []
        for i in 1:5
            cp_data_single = CSV.read(joinpath(DATADIR, "CAUSES_PROBLEMS_" * string(i) * ".csv");  header = true, delim = ';', quotechar = '"')
            pe_data_single = CSV.read(joinpath(DATADIR, "PROBLEMS_EFFECTS_" * string(i) * ".csv"); header = true, delim = ';', quotechar = '"')

            deletecols!(cp_data_single, Symbol("v_" * string(276 + i)))
            deletecols!(pe_data_single, Symbol("v_" * string(281 + i)))

            rename!(cp_data_single, [ :tag => :CAUSES_CODE, Symbol("v_" * string(244 + i * 2)) => :PROBLEMS_CODE ])
            rename!(pe_data_single, [ :tag => :EFFECTS_CODE, Symbol("v_" * string(244 + i * 2)) => :PROBLEMS_CODE ])

            data_single = join(cp_data_single, pe_data_single, on = [ :lfdn, :PROBLEMS_CODE ])
            data_single[:Rank] = i

            push!(data, data_single)
        end
        data = vcat(data...)
        data[:lfdn] = map(x -> convert(Int, x), data[:lfdn])



        for (nt, nt_id_map) in node_ids
            categ_col = sort(unique(data[nt]))

            for (idx, categ) in enumerate(categ_col)
                sym = Symbol(string(nt) * "_" * @sprintf("%02d", idx))

                nt_id_map[categ] = sym
                descriptions[sym] = categ
                push!(items[nt], sym)
            end
        end

         __dummy!(data, :CAUSES_CODE, node_ids[:CAUSES_CODE])
         __dummy!(data, :PROBLEMS_CODE, node_ids[:PROBLEMS_CODE])
         __dummy!(data, :EFFECTS_CODE, node_ids[:EFFECTS_CODE])

         rename!(data, Dict(:Rank => :RANK, :lfdn => :ID))
         return __filter(data, items, descriptions, args...)
end

