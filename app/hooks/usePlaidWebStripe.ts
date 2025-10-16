// import { useState, useEffect, useCallback } from "react";
// import { usePlaidLink } from "react-plaid-link";
// import { useCreatePlaidLinkToken } from "./useCreatePlaidLinkToken";
// import { useExchangePublicToken } from "./useExchangePublicToken";
// import { useLinkBankAccounts } from "./useLinkBankAccount";

// export function usePlaidWebStripe(
//   triggerToast: (type: "success" | "error" | "info", message: string) => void
// ) {
//   // Hook to create the Plaid link token
//   const { mutateAsync: createLinkToken } = useCreatePlaidLinkToken();
//   // Hook to exchange the public token for an access token
//   const { mutate: exchangePublicToken } = useExchangePublicToken();
//   // Hook to link bank accounts using the exchanged data
//   const { mutate: linkBankAccounts } = useLinkBankAccounts();

//   const [linkToken, setLinkToken] = useState<string | null>(null);

//   // On mount, create a link token
//   useEffect(() => {
//     (async () => {
//       try {
//         const response = await createLinkToken();
//         const token = response?.data?.link_token;
//         if (!token) {
//           triggerToast("error", "Failed to create link token. Please try again.");
//           return;
//         }
//         setLinkToken(token);
//       } catch (error) {
//         triggerToast("error", "Failed to create link token.");
//       }
//     })();
//   }, [createLinkToken, triggerToast]);

//   // Callback for a successful Plaid Link flow
//   const onSuccess = useCallback(
//     (public_token: string, metadata: any) => {
//       // First, exchange the public token for an access token
//       exchangePublicToken(public_token, {
//         onSuccess: (exchangeResponse: any) => {
//           // Then, use the exchanged data to link the bank account
//           linkBankAccounts(exchangeResponse.data, {
//             onSuccess: () => {
//               triggerToast("success", "Bank account linked successfully");
//             },
//             onError: () => {
//               triggerToast("error", "Failed to link bank account");
//             },
//           });
//         },
//         onError: () => {
//           triggerToast("error", "Failed to exchange public token");
//         },
//       });
//     },
//     [exchangePublicToken, linkBankAccounts, triggerToast]
//   );

//   // Callback for when the user exits the Plaid Link flow
//   const onExit = useCallback(
//     (error: any, metadata: any) => {
//       if (error) {
//         triggerToast("error", "User exited the Link flow with an error");
//       } else {
//         triggerToast("info", "User exited the Link flow");
//       }
//     },
//     [triggerToast]
//   );

//   // Plaid Link configuration
//   const config = {
//     token: linkToken || "", // Must be a non-empty string when ready
//     onSuccess,
//     onExit,
//   };

//   // Initialize the Plaid Link hook
//   const { open, ready } = usePlaidLink(config);

//   // Function to start the Plaid Link flow
//   const handleLinkProcess = useCallback(() => {
//     if (!linkToken) {
//       triggerToast("error", "Link token is not available.");
//       return;
//     }
//     if (!ready) {
//       triggerToast("error", "Plaid Link is not ready yet.");
//       return;
//     }
//     open();
//   }, [linkToken, open, ready, triggerToast]);

//   return { handleLinkProcess };
// }
