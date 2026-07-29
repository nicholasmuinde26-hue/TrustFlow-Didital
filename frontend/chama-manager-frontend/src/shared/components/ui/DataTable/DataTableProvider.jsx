import { createContext, useContext } from "react";

const DataTableContext = createContext(null);

export function DataTableProvider({
    value,
    children,
}) {
    return (
        <DataTableContext.Provider value={value}>
            {children}
        </DataTableContext.Provider>
    );
}

export function useDataTableContext() {
    const context = useContext(DataTableContext);

    if (!context) {
        throw new Error(
            "useDataTableContext must be used inside DataTable."
        );
    }

    return context;
}