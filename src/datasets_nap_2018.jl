function nap_2018(args...)
    DATADIR = joinpath(dirname(@__FILE__), "../data/2018/")
    CONTEXT_FILENAME = joinpath(DATADIR, "napire_truth.csv")
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

    contextdata = CSV.read(CONTEXT_FILENAME; datarow = 2, delim = ';', quotechar = '"')
    contextdata_columns = [
        (:v_4,   :CONTEXT_SYSTEM, :CONTEXT_SYSTEM_00, "Software-intensive embedded systems", x -> x == "Software-intensive embedded systems"),
        (:v_4,   :CONTEXT_SYSTEM, :CONTEXT_SYSTEM_01, "Business information systems", x -> x == "Business information systems"),
        (:v_4,   :CONTEXT_SYSTEM, :CONTEXT_SYSTEM_02, "Hybrid of both software-intensive embedded systems and business information systems", x -> x == "Hybrid of both software-intensive embedded systems and business information systems"),

        (:v_16,  :CONTEXT_DISTRIBUTED, :CONTEXT_DISTRIBUTED_00, "Distributed project", x -> x == "Yes"),

        (:v_24, :DEVELOPMENT, :DEVELOPMENT_CODE_00, "Agile", x -> x == "Agile"),
        (:v_24, :DEVELOPMENT, :DEVELOPMENT_CODE_01, "Rather agile", x -> x == "Rather agile"),
        (:v_24, :DEVELOPMENT, :DEVELOPMENT_CODE_02, "Hybrid", x -> x == "Hybrid"),
        (:v_24, :DEVELOPMENT, :DEVELOPMENT_CODE_03, "Rather plan-driven", x -> x == "Rather plan-driven"),
        (:v_24, :DEVELOPMENT, :DEVELOPMENT_CODE_04, "Plan-driven", x -> x == "Plan-driven"),

        (:v_25, :RELATIONSHIP, :RELATIONSHIP_CODE_00, "Very good", x -> x == "Very good"),
        (:v_25, :RELATIONSHIP, :RELATIONSHIP_CODE_01, "Good", x -> x == "Good"),
        (:v_25, :RELATIONSHIP, :RELATIONSHIP_CODE_02, "neutral", x -> x == "neutral"),
        (:v_25, :RELATIONSHIP, :RELATIONSHIP_CODE_03, "Bad", x -> x == "Bad"),
        (:v_25, :RELATIONSHIP, :RELATIONSHIP_CODE_04, "Very bad", x -> x == "Very bad") ]
    rename!(data, Dict(:Rank => :RANK, :lfdn => :ID))
    rename!(contextdata, Dict(:lfdn => :ID))

    data = __join_contextdata!(data, items, descriptions, contextdata, contextdata_columns)
    return __filter(data, items, descriptions, args...)
end

