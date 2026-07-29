import { useMemo, useState } from "react";

export default function useDataTable({
    rows = [],
}) {
    const [search, setSearch] = useState("");

    const [page, setPage] = useState(1);

    const [pageSize] = useState(10);

    const filteredRows = useMemo(() => {

        if (!search)
            return rows;

        return rows.filter((row) =>
            JSON.stringify(row)
                .toLowerCase()
                .includes(search.toLowerCase())
        );

    }, [rows, search]);

    const totalPages = Math.ceil(
        filteredRows.length / pageSize
    );

    const paginatedRows = useMemo(() => {

        const start =
            (page - 1) * pageSize;

        return filteredRows.slice(
            start,
            start + pageSize
        );

    }, [
        filteredRows,
        page,
        pageSize,
    ]);

    return {

        search,
        setSearch,

        page,
        setPage,

        totalPages,

        rows: paginatedRows,

        totalRows: filteredRows.length,

    };
}