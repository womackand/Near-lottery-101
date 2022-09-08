import {
    context,
    ContractPromiseBatch,
    logging,
    PersistentMap,
    PersistentUnorderedMap,
    RNG,
    storage,
    u128
} from "near-sdk-core";

@nearBindgen
export class Tickets {
    private _count: i32 = 0;

    public get value(): i32 {
        return this._count
    }

    public set update(value: i32) {
        this._count = value;
    }

    constructor(value: i32 = 0) {
        this._count = value
    }
}

@nearBindgen //serializes custom class before storing it on the blockchain
export class Lottery {
    id: i32;
    winner: string;
    noOfTicketsSold: u32;
    noOfPlayers: u32;
    winningTicket: u32;
    amountInLottery: u128;
    lotteryPrice: u128;
    lotteryStartTime: u64;
    lotteryEndTime: u64;
    private ticketIds: PersistentMap<u32, string>; //keeps track of ticketIds to their owners
    private playersTickets: PersistentMap<string, Tickets>; // keeps track of noOfTickets each player has bought

    public static newLottery(id: i32, noOfMins: u32): Lottery { //static method that takses a payload and returns a new Product object
        const lottery = new Lottery();
        lottery.id = id;
        lottery.winner = "";
        lottery.noOfTicketsSold = 0;
        lottery.noOfPlayers = 0;
        lottery.winningTicket = 0;
        lottery.amountInLottery = u128.from(0);
        lottery.lotteryPrice = get_ticket_price();
        lottery.lotteryStartTime = context.blockTimestamp;
        lottery.lotteryEndTime = context.blockTimestamp + (interval * noOfMins);
        lottery.ticketIds = new PersistentMap<u32, string>('l' + id.toString() + 'ids')
        lottery.playersTickets = new PersistentMap<string, Tickets>('l' + id.toString() + 'tkts');
        return lottery;
    }

    // if lottery is not valid, we simply just restart that same lottery
    public restartLottery(noOfMins: u32): void {
        this.lotteryPrice = get_ticket_price();
        this.lotteryStartTime = context.blockTimestamp;
        this.lotteryEndTime = context.blockTimestamp + (interval * noOfMins);
        update_rollover_status(false);
    }

    public buyTicket(noOfTickets: u32, totalAmount: u128): void {
        //check if lottery has ended
        if (context.blockTimestamp > this.lotteryEndTime) {
            throw new Error("Lottery has already ended")
        }

        const playerExistingTickets = this.getPlayerTickets(context.predecessor);

        //check if player already has a ticket, else update number of players
        if (!playerExistingTickets.value) {
            this.noOfPlayers += 1;
        }

        //update ticketIds Mapping and their owners;
        const oldTicketCount = this.noOfTicketsSold;
        const newTotal = oldTicketCount + noOfTickets;
        for (let i = oldTicketCount; i < newTotal; i++) {
            this.ticketIds.set(i, context.predecessor)
        }

        //update total no of tickets sold
        this.noOfTicketsSold += noOfTickets;

        // update player ticket mapping
        playerExistingTickets.update = playerExistingTickets.value + noOfTickets;

        this.playersTickets.set(context.predecessor, playerExistingTickets);

        // update amount in lottery
        this.amountInLottery = u128.add(this.amountInLottery, totalAmount);
    }

    public getWinningTicket(): void {
        // check if lottery has not ended
        if (context.blockTimestamp < this.lotteryEndTime) {
            throw new Error("Lottery has not already ended")
        }

        // check if valid raffle lottery criterias are met
        if (this.noOfTicketsSold < 5 || this.noOfPlayers < 2) {
            update_rollover_status(true);
            //update state
            setState(State.IDLE);
            return
        }

        const ticketID = getRandom() % this.noOfTicketsSold;

        this.winningTicket = ticketID;
        let winner = this.ticketIds.get(ticketID);

        if (winner === null) {
            throw new Error("Error in random generator")
        }
        this.winner = winner;
        setState(State.PAYOUT);
    }

    public payoutWinner(): void {
        const amountForWinner = u128.div(this.amountInLottery, u128.from(2));
        const amountForOwner = u128.div(amountForWinner, u128.from(2));
        ContractPromiseBatch.create(this.winner).transfer(amountForWinner);
        ContractPromiseBatch.create(get_operator()).transfer(amountForOwner);
        //this rest stays in the contract for storage
    }

    //Return players existing tickets
    public getPlayerTickets(playerId: string): Tickets {
        const playerTickets = this.playersTickets.get(playerId);

        if (playerTickets === null) {
            return new Tickets();
        } else {
            return playerTickets;
        }
    }
}

//Lottery mapping
export const Lotteries = new PersistentUnorderedMap<i32, Lottery>("Lotteries");

export function getLottery(id: i32): Lottery {
    const _lottery = Lotteries.get(id);

    if (_lottery === null) {
        throw new Error('Invalid lottery ID')
    }

    return _lottery;
}

//1 day in nanoseconds
const interval: u64 = (60 * 1000 * 1000000);

@nearBindgen
export class ILottery {
    id: i32;
    winner: string;
    noOfTicketsSold: u32;
    noOfPlayers: u32;
    winningTicket: u32;
    amountInLottery: u128;
    lotteryPrice: u128;
    lotteryStartTime: u64;
    lotteryEndTime: u64;
}


//Lottery states
export enum State {
    INACTIVE,
    IDLE,
    ACTIVE,
    PAYOUT
}

const initialState: State = State.INACTIVE;

export function setState(state: State): void {
    storage.set<State>("lotteryState", state)
}

export function getState(): State {
    if (!storage.contains("lotteryState")) { return initialState }
    return storage.getSome<State>("lotteryState")
}

//Lottery ID

const lotteryId: i32 = 0;

export function updateLotteryId(lotteryId: i32): void {
    storage.set<i32>("id", lotteryId)
}

export function getCurrentLotteryId(): i32 {
    return storage.getPrimitive<i32>("id", lotteryId)
}

//TIcket Pricing
//Default Value
const TICKET_PRICE: u128 = u128.from("1000000000000000000000000");

export function set_ticket_price(price: u128): void {
    storage.set<u128>("price", price)
}

export function get_ticket_price(): u128 {
    if (!storage.contains("price")) { return TICKET_PRICE }
    return storage.getSome<u128>("price")
}

//Set Operator Access
export function set_operator(operator: string): void {
    storage.set<string>("operator", operator)
}

export function get_operator(): string {
    return storage.getPrimitive<string>("operator", "lottery_v2.blockydevjoe.testnet")
}

//Rollover Status
export function update_rollover_status(status: bool): void {
    storage.set<bool>('rollover', status)
}
export function check_rollover(): bool {
    return storage.getPrimitive<bool>('rollover', false)
}

//Other Functions
function getRandom(): u32 {
    const rng = new RNG<u32>(1, u32.MAX_VALUE);
    const roll = rng.next();
    logging.log("roll: " + roll.toString());
    return roll
}

export function checkState(state: State): bool {
    const currState: State = getState();

    if (state !== currState) {
        throw new Error("current state does not allow this")
    }

    return true;
}



