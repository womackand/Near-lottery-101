export function convertTime(nanosecs) {
  if (nanosecs === 0) {
    return "--";
  }

  let dateObj = new Date(nanosecs / 1000000);

  let date = dateObj.toLocaleDateString("en-us", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  let time = dateObj.toLocaleString("en-us", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
  return date + ", " + time;
}

export function checkStatus(status, lotteryEndTime) {
  const now = new Date();
  const end = new Date(lotteryEndTime / 1000000);

  if (status === 2 && lotteryEndTime !== 0 && now > end) {
    return "Ended, Waiting for payouts";
  } else {
    switch (status) {
      case 0: {
        return "Inactive";
      }
      case 1: {
        return "Reboot";
      }
      case 2: {
        return "Active";
      }
      case 3: {
        return "Payout";
      }
      default: {
        return "Loading";
      }
    }
  }
}
