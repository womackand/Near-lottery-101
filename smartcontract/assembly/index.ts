import * as lottery from "./model";
import { u128, context, logging } from 'near-sdk-as';

/**
 * Init function can only be called once and it is used to initialize the contract with a lottery operator.
 * @param operator Account ID of the lottery operator
 */
export function init(operator: string): void {
    assert(context.predecessor == context.contractName, "Method init is private");

    //check if state is already is still in inactive
    assert(lottery.checkState(lottery.State.INACTIVE), "Lottery already initiated");

    // set lottery operator
    lottery.set_operator(operator);

    // update lottery state to idle
    lottery.setState(lottery.State.IDLE);
    logging.log("Lottery initiated")
}


/**
 * startLottery function used to start the next lottery. And to do that, lottery should be in IDLE.
 * @param TICKET_PRICE Price of the next lottery in u128 format
 * @param noOfDays How many days after this lottery expires
 */
export function startLottery(TICKET_PRICE: u128, noOfMins: u32): void {
    // check if context is operator
    assert(context.sender == lottery.get_operator(), "Access restricted to lottery operator")

    // check if lottery state is set to IDLE
    assert(lottery.checkState(lottery.State.IDLE))

    // set ticket price
    lottery.set_ticket_price(TICKET_PRICE);

    // retrieve lottery id from storage
    let id = lottery.getCurrentLotteryId();

    // check if previous lottery was rollovered then update accordingly
    if (lottery.check_rollover()) {
        // get lottery
        const _lottery = lottery.getLottery(id);

        // restart lottery
        _lottery.restartLottery(noOfMins);

        // update lottery in storage
        lottery.Lotteries.set(id, _lottery);

        logging.log("Lottery Restarted")
    } else {
        // update lottery id by 1
        let newId: i32 = id + 1;

        // start lottery
        lottery.Lotteries.set(newId, lottery.Lottery.newLottery(newId, noOfMins));

        // update lottery
        lottery.updateLotteryId(newId);

        logging.log("New Lottery Started")
    }

    // update lottery state
    lottery.setState(lottery.State.ACTIVE);

}

/**
 * buyTicket function used to buy tickets for the current lottery.
 * */
export function buyTicket(noOfTickets: u32): void {
    // check if lottery state is set to ACTIVE
    assert(lottery.checkState(lottery.State.ACTIVE));

    // get lottery
    const id = lottery.getCurrentLotteryId();
    const _lottery = lottery.getLottery(id);

    // get ticket price and calc how much to be spent to purchase tickets
    const amountToBePaid = u128.mul(_lottery.lotteryPrice, u128.from(noOfTickets));
    // check if attached deposit is up to that amount
    if (amountToBePaid.toString() != context.attachedDeposit.toString()) {
        throw new Error("Insufficient amount")
    }

    //initiate ticket purchase
    _lottery.buyTicket(noOfTickets, amountToBePaid);

    //update lottery in storage
    lottery.Lotteries.set(id, _lottery)
}


/**
 * getWinningTicket function used to generate the winning ticket for the current lottery.
 * It is only available to lottery operator
 * @param noOfTickets Number of tickets that the user wants to buy.
 * */
export function getWinningTicket(): void {
    // check if context is operator
    assert(context.sender == lottery.get_operator(), "Access restricted to lottery operator")

    // check if lottery state is set to ACTIVE
    assert(lottery.checkState(lottery.State.ACTIVE))

    // get lottery
    const id = lottery.getCurrentLotteryId();
    const _lottery = lottery.getLottery(id);

    // initiate
    _lottery.getWinningTicket()

    // update lottery in storage
    lottery.Lotteries.set(id, _lottery);

    if (_lottery.winner != "") {
        logging.log("Winning Ticket Gotten")
    } else {
        logging.log("Not Enough players please restart the Lottery")
    }
}


/**
 * payoutWinner function used to payout the winning amount for winner of the current lottery.
 * To do that, lottery should be in PAYOUT state.
 * It is only available to lottery operator.
 */
export function payoutWinner(): void {
    // check if context is operator
    assert(context.sender == lottery.get_operator(), "Access restricted to lottery operator")

    // check if lottery state is set to PAYOUT
    assert(lottery.checkState(lottery.State.PAYOUT))

    // get lottery
    const id = lottery.getCurrentLotteryId();
    const _lottery = lottery.getLottery(id);

    // initiate
    _lottery.payoutWinner();

    // update lottery in storage
    lottery.Lotteries.set(id, _lottery);

    // update lottery state
    lottery.setState(lottery.State.IDLE);
    logging.log("Payout successful, Lottery Ended")
}


/**
 * newOperator function used to set a new operator for contract
 * To do that, lottery should be in IDLE state.
 * It is only available to contract.
 */
export function newOperator(newOperatorId: string): void {
    // check if context is contract
    assert(context.predecessor == context.contractName, "Method is private");

    // check if lottery state is set to IDLE
    assert(lottery.checkState(lottery.State.IDLE))

    // set lottery operator
    lottery.set_operator(newOperatorId);

    logging.log("New Operator assigned")
}


/**
 * getLotteryOperator function used to get the lottery operator
 * @return lottery operator
 * */
export function getLotteryOperator(): string {
    return lottery.get_operator();
}


/**
 * getPlayerTickets function used to get the number of tickets bought by the given user for the given lottery.
 * @param id Lottery Id
 * @param playerId User ID
 * @return Number of tickets bought by the user for the lottery
 * */
export function getPlayerTickets(id: i32, playerId: string): i32 {
    // get lottery
    const _lottery = lottery.Lotteries.get(id);

    if (_lottery === null) {
        return 0
    }

    // return value of the number of tickets
    return _lottery.getPlayerTickets(playerId).value
}


/**
 * getLotteryStatus function used to get the current state of the lottery.
 * @return Current state of the lottery
 * */
export function getLotteryStatus(): lottery.State {
    return lottery.getState();
}


/**
 * getLottery function used to get the details of the given lottery id.
 * @param id Lottery ID
 * @return Details of the lottery if present. Otherwise null
 * */
export function getLottery(id: i32): lottery.ILottery | null {
    const _lottery = lottery.Lotteries.get(id);

    if (_lottery === null) {
        return null
    }

    const output: lottery.ILottery = {
        id: _lottery.id,
        winner: _lottery.winner,
        noOfTicketsSold: _lottery.noOfTicketsSold,
        noOfPlayers: _lottery.noOfPlayers,
        winningTicket: _lottery.winningTicket,
        amountInLottery: _lottery.amountInLottery,
        lotteryPrice: _lottery.lotteryPrice,
        lotteryStartTime: _lottery.lotteryStartTime,
        lotteryEndTime: _lottery.lotteryEndTime,
    }

    return output;
}


/**
 * getLotteryId function used to get the lottery ID of the current active lottery.
 * @return Lottery ID of the current lottery
 * */
export function getLotteryId(): i32 {
    return lottery.getCurrentLotteryId()
}


/**
 * checkRolloverStatus function used to get the rollover status for the latest lottery.
 * @return Rollover status for the latest lottery
 * */
export function checkRolloverStatus(): bool {
    return lottery.check_rollover()
}