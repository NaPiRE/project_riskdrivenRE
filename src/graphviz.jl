module graphviz

    macro exported_enum(name, args...)
        esc(quote
            @enum($name, $(args...))
            export $name
            $([:(export $arg) for arg in args]...)
            end)
    end

    @enum DotGraphProps begin
        ranksep
    end

    @enum DotNodeProps begin
        label
        shape
    end

    @enum DotEdgeProps begin
        penwidth
        color
    end

    @enum OutputType begin
        dot
        png
    end

    struct Dot
        edges::Array{Pair{Symbol, Symbol}}
        nodes::Set{Symbol}

        graph_props::Dict{DotGraphProps, String}
        node_props::Dict{Symbol, Dict{DotNodeProps, String}}
        edge_props::Dict{Pair{Symbol, Symbol}, Dict{DotEdgeProps, String}}

        function Dot(edges)
            nodes = Set{Symbol}()
            for edge in edges
                push!(nodes, edge.first)
                push!(nodes, edge.second)
            end

            new(collect(edges), nodes,
                Dict{DotGraphProps, String}(),
                Dict{Symbol, Dict{DotNodeProps, String}}(),
                Dict{Pair{Symbol, Symbol}, Dict{DotEdgeProps, String}}())
        end
    end
    export Dot

    function set(graph::Dot, node::Symbol, prop::DotNodeProps, value)
        get!(graph.node_props, node, Dict{DotNodeProps, String}())[prop] = string(value)
    end

    function set(graph::Dot, edge::Pair{Symbol, Symbol}, prop::DotEdgeProps, value)
        get!(graph.edge_props, edge, Dict{DotEdgeProps, String}())[prop] = string(value)
    end

    function set(graph::Dot, prop::DotGraphProps, value)
        graph.graph_props[prop] = string(value)
    end
    export set

    function plot(graph::Dot, output_type::Val{dot})
        dotsrc = "digraph out {\n"
        dotsrc *= "graph" * __to_dot_props(graph.graph_props)

        for node in graph.nodes
            dotsrc *= __to_dot_string(node) * __to_dot_props(get(graph.node_props, node, Dict{DotNodeProps, String}()))
        end

        for edge in graph.edges
            dotsrc *= __to_dot_string(edge.first) * " -> " * __to_dot_string(edge.second) * __to_dot_props(get(graph.edge_props, edge, Dict{DotEdgeProps, String}()))
        end

        dotsrc *= "}"
        return dotsrc
    end

    function plot(graph::Dot, output_type::Val{png})
        dotsrc = plot(graph, Val(dot))

        dotfile = tempname()
        pngfile = tempname()
        try
            write(dotfile, dotsrc)
            run(`dot -o$pngfile -Tpng $dotfile`)
            return read(pngfile)
        finally
            rm(dotfile, force = true)
            rm(pngfile, force = true)
        end
    end
    export plot

    function __to_dot_string(obj::Any)
        return replace(string(obj), ("\"" => "\\\""))
    end

    function __to_dot_props(props::Union{Dict{DotGraphProps, String}, Dict{DotNodeProps, String}, Dict{DotEdgeProps, String}})
        out = [ ]
        for (key, value) in props
            key = string(key)
            value = __to_dot_string(value)
            push!(out, "$key = \"$value\"")
        end

        return " [" * join(out, ", ") * "];\n"
    end

end
