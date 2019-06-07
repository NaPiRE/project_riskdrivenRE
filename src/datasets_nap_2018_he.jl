function nap_2018_he(args...)
    DATADIR = joinpath(dirname(@__FILE__), "../data/2018_he/")
    CONTEXT_FILENAME = joinpath(DATADIR, "napire_truth.csv")
    NODE_TYPES =  [:CAUSES_CODE, :PROBLEMS_CODE, :EFFECTS_CODE ]

    node_ids = Dict( nt => Dict{Int64, Symbol}() for nt in NODE_TYPES)
    descriptions = Dict{Symbol, Union{Missing, String}}()
    items = Dict{Symbol, Set{Symbol}}(nt => Set{Symbol}() for nt in NODE_TYPES)
    for (nt, nt_id_map) in node_ids
        data = CSV.read(joinpath(DATADIR, string(nt) * ".csv"); header = true, delim = ',', quotechar = '"')

        for row in eachrow(data)
            sym = Symbol(string(nt) * "_" * @sprintf("%02d", row[2]))

            nt_id_map[row[2]] = sym
            descriptions[sym] = row[1]
            push!(items[nt], sym)
        end
    end

    cp_data = CSV.read(joinpath(DATADIR, "CAUSES_PROBLEMS.csv");  header = true, delim = ',', quotechar = '"')
    pe_data = CSV.read(joinpath(DATADIR, "PROBLEMS_EFFECTS.csv"); header = true, delim = ',', quotechar = '"')

    data = join(cp_data, pe_data, on = [ :lfdn, :Rank, :ProblemId ], makeunique = true )
    data = data[:, [ :lfdn, :Rank, :CauseId, :ProblemId, :EffectId ]]

    __dummy!(data, :CauseId, node_ids[:CAUSES_CODE])
    __dummy!(data, :ProblemId, node_ids[:PROBLEMS_CODE])
    __dummy!(data, :EffectId, node_ids[:EFFECTS_CODE])

    rename!(data, Dict(:Rank => :RANK, :lfdn => :ID))

    contextdata, contextdata_columns = __nap_2018_contextdata(CONTEXT_FILENAME)
    data = __join_contextdata!(data, items, descriptions, contextdata, contextdata_columns)

    return __filter(data, items, descriptions, args...)
end

