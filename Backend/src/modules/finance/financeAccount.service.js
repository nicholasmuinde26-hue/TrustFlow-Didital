/**
 * ============================================================================
 * FINANCE ACCOUNT SERVICE
 * ============================================================================
 *
 * Financial Account infrastructure service.
 *
 * Responsibilities
 * ----------------
 * ✓ Resolve accounts
 * ✓ Apply ledger entries
 * ✓ Update balances
 * ✓ Provide account lookup helpers
 *
 * DOES NOT
 * --------
 * ✗ Build journals
 * ✗ Decide debit/credit
 * ✗ Know business flows
 * ✗ Create accounting rules
 *
 * Accounting flow:
 *
 * Business Service
 *        |
 *        v
 * AccountingService
 *        |
 *        v
 * JournalService
 *        |
 *        v
 * LedgerService
 *        |
 *        v
 * FinanceAccountService
 *
 * ============================================================================
 */


import mongoose from "mongoose";
import FinancialAccount from "../../models/FinancialAccount.js";

import {
    ENTRY_TYPES,
    ACCOUNT_NORMAL_BALANCE
} from "./accounting/accounting.constants.js";

import {
    toDecimal
} from "../../shared/decimal.js";



class FinanceAccountService {



    /**
     * =========================================================================
     * APPLY LEDGER ENTRIES
     * =========================================================================
     *
     * Receives finalized ledger entries and updates
     * account balances.
     *
     * =========================================================================
     */


    async applyEntries(
        entries = [],
        session = null
    ){

        const updatedAccounts = [];


        for(const entry of entries){


            const accountId =
                entry.account_id ||
                entry.account;



            const account =
                await FinancialAccount.findById(
                    accountId
                )
                .session(session);



            if(!account){

                throw new Error(
                    `Financial account '${accountId}' not found`
                );

            }



            this.applyEntry(
                account,
                entry
            );



            await account.save({
                session
            });



            updatedAccounts.push(account);


        }



        return updatedAccounts;


    }






    /**
     * =========================================================================
     * APPLY SINGLE LEDGER ENTRY
     * =========================================================================
     */


    applyEntry(
        account,
        entry
    ){

        const amount =
            toDecimal(
                entry.amount
            );

        const entryType =
            (
                entry.entry_type ||
                entry.type
            )
            .toLowerCase();

        switch(account.normal_balance){

            case ACCOUNT_NORMAL_BALANCE.DEBIT:

                this.applyDebitNormalAccount(
                    account,
                    entryType,
                    amount
                );

            break;

            case ACCOUNT_NORMAL_BALANCE.CREDIT:

                this.applyCreditNormalAccount(
                    account,
                    entryType,
                    amount
                );

            break;

            default:

                throw new Error(
                    `Unknown normal balance '${account.normal_balance}'`
                );

        }

        account.lastPostedAt =
            new Date();

    }





    /**
     * =========================================================================
     * DEBIT NORMAL BALANCE
     * =========================================================================
     *
     * Asset / Expense accounts
     *
     * Debit increases
     * Credit decreases
     *
     * =========================================================================
     */


    applyDebitNormalAccount(
        account,
        entryType,
        amount
    ){

        const currentBalance =
            toDecimal(
                account.current_balance
            );

        if(
            entryType === ENTRY_TYPES.DEBIT
        ){

            account.current_balance =
                mongoose.Types.Decimal128.fromString(
                    currentBalance.plus(amount).toFixed()
                );

        }

        else{

            account.current_balance =
                mongoose.Types.Decimal128.fromString(
                    currentBalance.minus(amount).toFixed()
                );

        }

    }






    /**
     * =========================================================================
     * CREDIT NORMAL BALANCE
     * =========================================================================
     *
     * Liability / Equity / Revenue accounts
     *
     * Credit increases
     * Debit decreases
     *
     * =========================================================================
     */


    applyCreditNormalAccount(
        account,
        entryType,
        amount
    ){

        const currentBalance =
            toDecimal(
                account.current_balance
            );

        if(
            entryType === ENTRY_TYPES.CREDIT
        ){

            account.current_balance =
                mongoose.Types.Decimal128.fromString(
                    currentBalance.plus(amount).toFixed()
                );

        }

        else{

            account.current_balance =
                mongoose.Types.Decimal128.fromString(
                    currentBalance.minus(amount).toFixed()
                );

        }

    }







    /**
     * =========================================================================
     * FIND ACCOUNT
     * =========================================================================
     */


    async findById(
        id
    ){

        return FinancialAccount.findById(id);

    }







    /**
     * =========================================================================
     * FIND ACCOUNT BY CODE
     * =========================================================================
     */


    async findByCode(
        code,
        owner_type = null,
        owner_id = null
    ){

        const query = {

            account_code: code

        };

        if(owner_type){

            query.owner_type =
                owner_type;

        }

        if(owner_id){

            query.owner_id =
                owner_id;

        }

        return FinancialAccount.findOne(
            query
        );

    }






    /**
     * =========================================================================
     * GET ACCOUNT
     * =========================================================================
     *
     * Compatibility helper for
     * accounting rules.
     *
     * =========================================================================
     */


    async getAccount({
        code,
        owner_type,
        owner_id,
        session = null
    }){

        const account =
            await FinancialAccount.findOne({

                account_code: code,

                owner_type,

                owner_id

            })
            .session(session);


        if(!account){

            throw new Error(

                `Account ${code} not found for ${owner_type}:${owner_id}`

            );

        }



        return account;


    }







}

/**
 * ============================================================================
 * LEGACY ACCOUNT RESOLVERS
 * ============================================================================
 *
 * Temporary compatibility layer.
 *
 * These will later move into accountResolver.service.js
 *
 * ============================================================================
 */


export const getContributionEquityAccount = async ({
    owner_type,
    owner_id,
    session = null
})=>{


    return FinancialAccount.findOne({

        owner_type,

        owner_id,

        account_code:
            "MEMBER_CONTRIBUTIONS"

    })    .session(session);


};





export const getPayoutPayableAccount = async ({
    owner_type,
    owner_id,
    session = null
})=>{


    return FinancialAccount.findOne({

        owner_type,

        owner_id,

        account_code:
            "PAYOUT_CLEARING"

    })    .session(session);


};





export const getContributionPaymentAssetAccount = async ({
    owner_type,
    owner_id,
    payment_method,
    session = null
})=>{


    const map = {


        cash:
            "CASH",


        bank:
            "BANK",


        mpesa:
            "MPESA_CLEARING"


    };



    return FinancialAccount.findOne({

        owner_type,

        owner_id,

        account_code:
            map[payment_method]

    })    .session(session);


};



export default new FinanceAccountService();