function nap_2014(args...)
    FILENAME = joinpath(dirname(@__FILE__), "../data/2014/napire.csv")

    #
    # CSV parsing
    #

    to_col_name = function(secname, number)
        return Symbol("$(String(secname))_$(@sprintf("%02d", number))")
    end

    data = CSV.read(FILENAME; datarow = 1, delim = ';', quotechar = '"');
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

    rankcol = :IDENTIFIERS_RANK_00
    subjectcol = :IDENTIFIERS_SUBJECT_00

    return __filter(data, items, descriptions, rankcol, subjectcol, args...)
end
