const dotenv = require("dotenv");
const express = require("express");
const WebSocket = require("ws");

dotenv.config();

const app = express();
const PORT = 3000;

const API_TOKEN = process.env.DERIV_TOKEN;
const GET_OTP_ENDPOINT = `${process.env.DERIV_ENDPOINT}/trading/v1/options/accounts/${process.env.DERIV_ACCOUNTID}/otp`
let endpoint_with_otp;


// {
//   data: {
//     account_id: 'DOT91824518',
//     balance: 10000.96,
//     currency: 'USD',
//     group: 'row',
//     status: 'active',
//     account_type: 'demo'
//   },
//   meta: {
//     endpoint: '/api:MuMtGTt2/options/accounts',
//     method: 'POST',
//     timing: 87
//   }
// }

// Replace these with your actual Deriv account details
const accountId = process.env.DERIV_ACCOUNTID; // Your Options Trading Account ID
const authToken = process.env.DERIV_TOKEN; 
const appId = process.env.DERIV_APPID;

async function getDerivOTP() {
    let account_id;
    try {
        const response = await fetch(
            `https://api.derivws.com/trading/v1/options/accounts`,
            {
                method: 'POST',
                headers: {
                    'Deriv-App-ID': appId,
                    'Authorization': `Bearer ${authToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    currency: "USD",
                    group: "row",
                    account_type: "demo"
                })
            }
        );

        const result = await response.json();

        if (response.ok && result.data) {
            account_id = result.data.account_id;
            console.table(result.data)
        } else {
            console.error('Failed to create account:', result);
        }
    } catch (error) {
        console.error('Error creating trading accounts:', error);
    }


    try {
        const trading_otp = `https://api.derivws.com/trading/v1/options/accounts/${account_id}/otp`;
        const response = await fetch(
            trading_otp,
            {
                method: 'POST',
                headers: {
                    'Deriv-App-ID': appId,
                    'Authorization': `Bearer ${authToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const result = await response.json();

        if (response.ok && result.data && result.data.url) {
            console.log('Authenticated WebSocket URL:', result.data.url);
            // Example Output: wss://://derivws.com

            const ws = new WebSocket(trading_otp);

            let latestData = null;

            ws.onopen = () => {
              console.log("Connected to Deriv WebSocket");

              // Authorize
              ws.send(JSON.stringify({ authorize: API_TOKEN }));

              // Subscribe to ticks for EURUSD (change symbol if needed)
              ws.send(JSON.stringify({ ticks: "frxEURUSD", subscribe: 1 }));
            };

            ws.onmessage = (event) => {
              const message = JSON.parse(event.data);

              // Capture tick data
              if (message.tick) {
                latestData = {
                  symbol: message.tick.symbol,
                  quote: message.tick.quote,
                  epoch: message.tick.epoch,
                };
                console.log("Tick received:", latestData);
              } else {
                console.log("Received:", message);
              }
            };

            ws.onerror = (error) => {
              console.error("WebSocket error:", error);
            };

            // SSE endpoint
            app.get("/stream", (req, res) => {
              res.setHeader("Content-Type", "text/event-stream");
              res.setHeader("Cache-Control", "no-cache");
              res.setHeader("Connection", "keep-alive");

              const interval = setInterval(() => {
                if (latestData) {
                  res.write(`data: ${JSON.stringify(latestData)}\n\n`);
                }
              }, 500);

              req.on("close", () => {
                clearInterval(interval);
              });
            });
            
            // You can now connect to this wss URL to perform your trading operations
        } else {
            console.error('Failed to get OTP:', result);
        }
    } catch (error) {
        console.error('Error fetching OTP:', error);
    }
}

getDerivOTP();



app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
