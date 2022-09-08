import React, { useEffect, useCallback, useState } from "react";
import { Container, Nav } from "react-bootstrap";
import { login, logout as destroy, accountBalance } from "./utils/near";
import { Notification } from "./components/ui/Notifications";
import Wallet from "./components/Wallet";
import Cover from "./components/ui/Cover";
import Lottery from "./components/Lottery/Lottery";
import coverImg from "./components/assets/img/balls.png";
import "./App.css";

const App = function AppWrapper() {
  const account = window.walletConnection.account();
  const [balance, setBalance] = useState("0");

  const getBalance = useCallback(async () => {
    if (account.accountId) {
      setBalance(await accountBalance());
    }
  }, [account]);

  useEffect(() => {
    getBalance();
  }, [getBalance]);

  return (
    <>
      <Notification />
      {account.accountId ? (
        <>
          <Container fluid="md" className="hero">
            <Nav className="justify-content-end pt-3 pb-5">
              <Nav.Item>
                {/*display user wallet*/}
                <Wallet
                  address={account.accountId}
                  amount={balance}
                  symbol="NEAR"
                  destroy={destroy}
                />
              </Nav.Item>
            </Nav>
            <div className="header">
              <p className="title light">NEAR Lottery</p>
              <p className="subtitle light">
                A lottery platform built on top of Near Protocol 🔦
              </p>
            </div>
            {/* display cover */}
          </Container>
          <Lottery />
        </>
      ) : (
        // display cover if user is not connected
        <Cover name="NEAR LOTTERY" login={login} coverImg={coverImg} />
      )}
    </>
  );
};

export default App;
