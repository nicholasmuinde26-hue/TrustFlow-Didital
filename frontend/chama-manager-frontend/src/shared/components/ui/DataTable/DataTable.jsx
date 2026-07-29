import Card from "../Card";

import {
    DataTableProvider,
} from "./DataTableProvider";

export default function DataTable({

    children,

    table,

}) {
    return (

        <DataTableProvider
            value={table}
        >

            <Card>

                {children}

            </Card>

        </DataTableProvider>

    );
}