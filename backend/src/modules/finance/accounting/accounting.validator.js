/**
 * ============================================================================
 * ACCOUNTING VALIDATOR
 * ============================================================================
 *
 * Validates accounting instructions before journal creation.
 *
 * Responsibilities:
 *
 * ✓ Validate posting structure
 * ✓ Validate debit / credit balance
 * ✓ Validate entries
 * ✓ Validate amounts
 *
 * DOES NOT:
 *
 * ✗ Resolve accounts
 * ✗ Create journals
 * ✗ Modify balances
 * ✗ Know business logic
 *
 * ============================================================================
 */


import {
    ENTRY_TYPES
} from "./accounting.constants.js";



class AccountingValidator {



    /**
     * =========================================================================
     * VALIDATE POSTING
     * =========================================================================
     */


    validate(posting){



        if(!posting){

            throw new Error(
                "Accounting posting is required"
            );

        }



        if(
            !posting.entries ||
            !Array.isArray(posting.entries)
        ){

            throw new Error(
                "Accounting posting requires entries"
            );

        }



        if(
            posting.entries.length < 2
        ){

            throw new Error(
                "Double entry requires at least two entries"
            );

        }



        this.validateEntries(
            posting.entries
        );



        this.validateBalance(
            posting.entries
        );



        return true;


    }








    /**
     * =========================================================================
     * VALIDATE ENTRIES
     * =========================================================================
     */


    validateEntries(entries){



        for(const entry of entries){



            const accountReference =
                entry.account_id ||
                entry.account ||
                entry.accountCode;

            if(!accountReference){

                throw new Error(
                    "Every accounting entry requires an account reference"
                );

            }



            if(
                !entry.entryType &&
                !entry.entry_type &&
                !entry.type
            ){

                throw new Error(
                    "Every accounting entry requires entry type"
                );

            }




            const type =
                (
                    entry.entryType ||
                    entry.entry_type ||
                    entry.type
                )
                .toLowerCase();

            if(
                type !== ENTRY_TYPES.DEBIT &&
                type !== ENTRY_TYPES.CREDIT
            ){
                throw new Error(
                    `Invalid entry type ${type}`
                );

            }





            if(
                entry.amount === undefined ||
                entry.amount === null
            ){

                throw new Error(
                    "Accounting entry amount required"
                );

            }



            if(
                Number(entry.amount) <= 0
            ){

                throw new Error(
                    "Accounting entry amount must be positive"
                );

            }


        }



    }









    /**
     * =========================================================================
     * VALIDATE DOUBLE ENTRY BALANCE
     * =========================================================================
     */


    validateBalance(entries){



        let debit = 0;

        let credit = 0;



        for(const entry of entries){



            const amount =
                Number(entry.amount);



            const type =
                (
                    entry.entryType ||
                    entry.entry_type ||
                    entry.type
                )
                .toLowerCase();

            if(
                type === ENTRY_TYPES.DEBIT
            ){
                debit += amount;

            }



            if(
                type === ENTRY_TYPES.CREDIT
            ){

                credit += amount;

            }



        }




        if(
            debit !== credit
        ){

            throw new Error(

                `Unbalanced accounting entry. Debit ${debit}, Credit ${credit}`

            );

        }



    }



}



export default new AccountingValidator();