import mongoose from 'mongoose';


// ========================================
// FINANCIAL ACCOUNT SCHEMA
// ========================================
//
// Represents an accounting account used by
// the ChamaManager Finance Engine.
//
// An account belongs to exactly ONE owner:
//
// 1. Chama
// 2. ContributionGroup
//
// IMPORTANT:
//
// ContributionGroups are independent entities.
//
// A ContributionGroup does NOT need to belong
// to a Chama in order to exist or operate.
//
// Therefore:
//
// Chama
//   └── FinancialAccount
//
// ContributionGroup
//   └── FinancialAccount
//
// There is NO direct dependency between:
//
// Chama
//     and
// ContributionGroup
//
// The owner_type + owner_id combination
// determines the financial account owner.
//
// ========================================
//
// ACCOUNTING TYPES
//
// asset
// liability
// equity
// income
// expense
//
// ========================================
//
// ACCOUNTING NORMAL BALANCES
//
// Asset      → Debit
// Expense    → Debit
//
// Liability  → Credit
// Equity     → Credit
// Income     → Credit
//
// ========================================


const financialAccountSchema =
  new mongoose.Schema(
    {

      // ========================================
      // ACCOUNT OWNER TYPE
      // ========================================
      //
      // Determines which domain entity owns
      // this accounting account.
      //
      // Chama:
      //   owner_id → Chama._id
      //
      // ContributionGroup:
      //   owner_id → ContributionGroup._id
      //
      // ========================================

      owner_type: {

        type:
          String,

        enum: [

          'Chama',

          'ContributionGroup'

        ],

        required:
          true,

        index:
          true

      },


      // ========================================
      // ACCOUNT OWNER ID
      // ========================================
      //
      // The ID of the entity represented by
      // owner_type.
      //
      // This is intentionally NOT a ref because
      // owner_type can reference multiple models.
      //
      // The Finance Account Service is responsible
      // for validating the owner.
      //
      // ========================================

      owner_id: {

        type:
          mongoose.Schema.Types.ObjectId,

        required:
          true,

        index:
          true

      },


      // ========================================
      // ACCOUNT NAME
      // ========================================
      //
      // Human-readable account name.
      //
      // Examples:
      //
      // Main Cash
      // M-Pesa Wallet
      // Main Bank Account
      // Member Contributions
      // Loans Receivable
      // Loan Interest Income
      // Operating Expenses
      //
      // Users may see this name in the UI.
      //
      // ========================================

      name: {

        type:
          String,

        required:
          true,

        trim:
          true,

        minlength:
          2,

        maxlength:
          100

      },


      // ========================================
      // SYSTEM ACCOUNT KEY
      // ========================================
      //
      // Stable internal identifier for system
      // generated accounts.
      //
      // Examples:
      //
      // cash
      // mpesa
      // bank
      // member_contributions
      // loans_receivable
      // loan_interest_income
      // expenses
      //
      // This is more reliable than using
      // the human-readable account name.
      //
      // Example:
      //
      // name:
      //   "Main M-Pesa Wallet"
      //
      // system_key:
      //   "mpesa"
      //
      // The name can change.
      //
      // The system_key should remain stable.
      //
      // ========================================

      system_key: {

        type:
          String,

        trim:
          true,

        lowercase:
          true,

        maxlength:
          50,

        default:
          null

      },


      // ========================================
      // ACCOUNT CODE
      // ========================================
      //
      // Human-readable accounting code.
      //
      // Suggested numbering:
      //
      // 1000 - Assets
      // 1100 - Cash
      // 1200 - M-Pesa
      // 1300 - Bank
      //
      // 1400 - Loans Receivable
      //
      // 2000 - Liabilities
      //
      // 3000 - Equity
      // 3100 - Member Contributions
      //
      // 4000 - Income
      // 4100 - Loan Interest Income
      //
      // 5000 - Expenses
      // 5100 - Operating Expenses
      //
      // The exact Chart of Accounts is managed
      // by financeAccount.service.js.
      //
      // ========================================

      account_code: {

        type:
          String,

        trim:
          true,

        maxlength:
          20,

        default:
          null

      },


      // ========================================
      // ACCOUNTING TYPE
      // ========================================
      //
      // The five fundamental accounting classes.
      //
      // ========================================

      account_type: {

        type:
          String,

        enum: [

          'asset',

          'liability',

          'equity',

          'income',

          'expense'

        ],

        required:
          true,

        index:
          true

      },


      // ========================================
      // NORMAL BALANCE
      // ========================================
      //
      // Determines whether the account normally
      // increases with a debit or credit.
      //
      // Asset:
      //   Debit increases
      //
      // Expense:
      //   Debit increases
      //
      // Liability:
      //   Credit increases
      //
      // Equity:
      //   Credit increases
      //
      // Income:
      //   Credit increases
      //
      // ========================================

      normal_balance: {

        type:
          String,

        enum: [

          'debit',

          'credit'

        ],

        required:
          true

      },


      // ========================================
      // ACCOUNT CATEGORY
      // ========================================
      //
      // Provides more detailed classification
      // while preserving the five fundamental
      // accounting types above.
      //
      // ========================================

      account_category: {

        type:
          String,

        enum: [

          'cash',

          'bank',

          'mpesa',

          'mobile_money',

          'receivable',

          'payable',

          'contribution',

          'loan',

          'payout',

          'welfare',

          'savings',

          'income',

          'expense',

          'equity',

          'clearing',

          'other'

        ],

        default:
          'other',

        required:
          true

      },


      // ========================================
      // CURRENCY
      // ========================================
      //
      // KES is the default currency because
      // ChamaManager is primarily designed for
      // the Kenyan financial ecosystem.
      //
      // The architecture still supports other
      // currencies.
      //
      // Examples:
      //
      // KES
      // USD
      // EUR
      //
      // ========================================

      currency: {

        type:
          String,

        default:
          'KES',

        uppercase:
          true,

        trim:
          true,

        minlength:
          3,

        maxlength:
          3,

        required:
          true

      },


      // ========================================
      // CURRENT BALANCE
      // ========================================
      //
      // Cached account balance.
      //
      // IMPORTANT:
      //
      // This is NOT the authoritative accounting
      // history.
      //
      // LedgerEntry remains the source of truth.
      //
      // current_balance exists for fast reads.
      //
      // It should ONLY be modified through the
      // Finance Transaction Posting Service.
      //
      // Monetary precision:
      //
      // MongoDB Decimal128
      //
      // ========================================

      current_balance: {

        type:
          mongoose.Schema.Types.Decimal128,

        default:
          0

      },


      // ========================================
      // ACCOUNT STATUS
      // ========================================
      //
      // active:
      //   Account can participate in transactions.
      //
      // inactive:
      //   Temporarily disabled.
      //
      // closed:
      //   Permanently closed.
      //
      // Historical ledger entries remain intact.
      //
      // ========================================

      status: {

        type:
          String,

        enum: [

          'active',

          'inactive',

          'closed'

        ],

        default:
          'active',

        required:
          true,

        index:
          true

      },


      // ========================================
      // SYSTEM ACCOUNT
      // ========================================
      //
      // Indicates that the account was created
      // by the Finance Engine.
      //
      // Examples:
      //
      // Cash
      // M-Pesa
      // Bank
      // Member Contributions
      // Loans Receivable
      // Loan Interest Income
      // Operating Expenses
      //
      // System accounts should not be deleted
      // directly.
      //
      // They should instead be closed or
      // deactivated according to Finance Engine
      // rules.
      //
      // ========================================

      is_system_account: {

        type:
          Boolean,

        default:
          false

      },


      // ========================================
      // ACCOUNT DESCRIPTION
      // ========================================

      description: {

        type:
          String,

        default:
          '',

        trim:
          true,

        maxlength:
          500

      },


      // ========================================
      // CREATED BY
      // ========================================
      //
      // User responsible for creating the
      // account.
      //
      // System-created accounts may have null.
      //
      // ========================================

      created_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null

      },


      // ========================================
      // CLOSED DATE
      // ========================================

      closed_at: {

        type:
          Date,

        default:
          null

      }

    },

    {

      timestamps:
        true

    }

  );


// ========================================
// UNIQUE ACCOUNT CODE PER OWNER
// ========================================
//
// Each owner can only have one account
// with a particular account code.
//
// Example:
//
// Chama A
//   1100 → Cash
//
// Chama B
//   1100 → Cash
//
// This is valid because uniqueness is scoped
// to the owner.
//
// Sparse allows accounts without codes.
//
// ========================================

financialAccountSchema.index(

  {

    owner_type:
      1,

    owner_id:
      1,

    account_code:
      1

  },

  {

    unique:
      true,

    sparse:
      true,

    name:
      'unique_account_code_per_owner'

  }

);


// ========================================
// UNIQUE ACCOUNT NAME PER OWNER
// ========================================
//
// Prevents duplicate account names within
// the same Chama or ContributionGroup.
//
// ========================================

financialAccountSchema.index(

  {

    owner_type:
      1,

    owner_id:
      1,

    name:
      1

  },

  {

    unique:
      true,

    name:
      'unique_account_name_per_owner'

  }

);


// ========================================
// UNIQUE SYSTEM ACCOUNT PER OWNER
// ========================================
//
// Prevents duplicate system accounts such as:
//
// cash
// mpesa
// bank
// loans_receivable
//
// within the same owner.
//
// This is especially important when the
// Finance Account Service initializes the
// default Chart of Accounts.
//
// ========================================

financialAccountSchema.index(

  {

    owner_type:
      1,

    owner_id:
      1,

    system_key:
      1

  },

  {

    unique:
      true,

    sparse:
      true,

    name:
      'unique_system_key_per_owner'

  }

);


// ========================================
// OWNER ACCOUNT LOOKUP
// ========================================

financialAccountSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  status:
    1

});


// ========================================
// ACCOUNT TYPE LOOKUP
// ========================================

financialAccountSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  account_type:
    1

});


// ========================================
// SYSTEM ACCOUNT LOOKUP
// ========================================

financialAccountSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  is_system_account:
    1

});


// ========================================
// PRE-VALIDATION ACCOUNTING RULES
// ========================================
//
// Prevents invalid combinations such as:
//
// account_type: asset
// normal_balance: credit
//
// or:
//
// account_type: income
// normal_balance: debit
//
// These combinations violate the Finance
// Engine's accounting model.
//
// ========================================

financialAccountSchema.pre(

  'validate',

  function (next) {

    const debitNormalTypes = [

      'asset',

      'expense'

    ];


    const creditNormalTypes = [

      'liability',

      'equity',

      'income'

    ];


    // ======================================
    // VALIDATE DEBIT-NORMAL ACCOUNT
    // ======================================

    if (

      debitNormalTypes.includes(

        this.account_type

      ) &&

      this.normal_balance !==
        'debit'

    ) {

      return next(

        new Error(

          `Account type "${this.account_type}" must have a debit normal balance`

        )

      );

    }


    // ======================================
    // VALIDATE CREDIT-NORMAL ACCOUNT
    // ======================================

    if (

      creditNormalTypes.includes(

        this.account_type

      ) &&

      this.normal_balance !==
        'credit'

    ) {

      return next(

        new Error(

          `Account type "${this.account_type}" must have a credit normal balance`

        )

      );

    }


    // ======================================
    // SYSTEM KEY VALIDATION
    // ======================================
    //
    // Non-system accounts should not normally
    // have a system_key.
    //
    // ======================================

    if (

      !this.is_system_account &&

      this.system_key

    ) {

      return next(

        new Error(

          'Only system accounts can have a system_key'

        )

      );

    }


    // ======================================
    // CLOSED ACCOUNT VALIDATION
    // ======================================

    if (

      this.status ===
        'closed' &&

      !this.closed_at

    ) {

      this.closed_at =
        new Date();

    }


    // ======================================
    // ACTIVE / INACTIVE ACCOUNT
    // ======================================
    //
    // An account that is reopened should no
    // longer retain a closed timestamp.
    //
    // ======================================

    if (

      this.status !==
        'closed'

    ) {

      this.closed_at =
        null;

    }


    next();

  }

);


// ========================================
// EXPORT MODEL
// ========================================

export default mongoose.model(

  'FinancialAccount',

  financialAccountSchema

);