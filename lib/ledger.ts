// Running ledger + debt simplification for a Knot's shared expenses.
//
// Model: every bill has one payer (bills.added_by) who fronted total_amount.
// Every bill_splits row records what each involved person owes back (owed_share).
// Settlements are actual pay-back transactions between two specific people.
//
// Net balance for person X = (total they paid across all bills)
//                           - (total they owe across all bill splits)
//                           + (settlements they received)
//                           - (settlements they paid)
//
// Positive net balance = the group owes them money.
// Negative net balance = they owe the group money.

export type Bill = {
  id: string
  added_by: string
  total_amount: number
}

export type BillSplit = {
  bill_id: string
  user_id: string
  amount: number
}

export type Settlement = {
  from_user_id: string
  to_user_id: string
  amount: number
}

export type Member = {
  id: string
  name: string
}

export type SimplifiedDebt = {
  from: Member
  to: Member
  amount: number
}

/**
 * Computes each member's net balance across all bills and settlements in a knot.
 * Positive = owed money. Negative = owes money.
 */
export function computeNetBalances(
  bills: Bill[],
  splits: BillSplit[],
  settlements: Settlement[],
  members: Member[]
): Map<string, number> {
  const balances = new Map<string, number>()
  for (const m of members) balances.set(m.id, 0)

  // What each person paid at the register
  for (const bill of bills) {
    const current = balances.get(bill.added_by) || 0
    balances.set(bill.added_by, current + Number(bill.total_amount))
  }

  // What each person owes back
  for (const split of splits) {
    const current = balances.get(split.user_id) || 0
    balances.set(split.user_id, current - Number(split.amount))
  }

  // Settlements: paying reduces what you owe (or increases credit if overpaid),
  // receiving reduces what's owed to you.
  for (const s of settlements) {
    const fromBalance = balances.get(s.from_user_id) || 0
    balances.set(s.from_user_id, fromBalance + Number(s.amount))
    const toBalance = balances.get(s.to_user_id) || 0
    balances.set(s.to_user_id, toBalance - Number(s.amount))
  }

  return balances
}

/**
 * Greedy debt simplification: matches the biggest creditor against the biggest
 * debtor repeatedly until all balances are zero (within a cent). Minimizes the
 * number of individual payments needed to settle the whole group.
 */
export function simplifyDebts(
  balances: Map<string, number>,
  members: Member[]
): SimplifiedDebt[] {
  const memberById = new Map(members.map(m => [m.id, m]))
  const EPSILON = 0.01

  const creditors: { id: string; amount: number }[] = []
  const debtors: { id: string; amount: number }[] = []

  for (const [userId, balance] of balances.entries()) {
    if (balance > EPSILON) creditors.push({ id: userId, amount: balance })
    else if (balance < -EPSILON) debtors.push({ id: userId, amount: -balance })
  }

  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const result: SimplifiedDebt[] = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]
    const debtor = debtors[di]
    const settleAmount = Math.min(creditor.amount, debtor.amount)

    if (settleAmount > EPSILON) {
      const fromMember = memberById.get(debtor.id)
      const toMember = memberById.get(creditor.id)
      if (fromMember && toMember) {
        result.push({ from: fromMember, to: toMember, amount: Math.round(settleAmount * 100) / 100 })
      }
    }

    creditor.amount -= settleAmount
    debtor.amount -= settleAmount

    if (creditor.amount <= EPSILON) ci++
    if (debtor.amount <= EPSILON) di++
  }

  return result
}
