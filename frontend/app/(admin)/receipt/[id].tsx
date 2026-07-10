// Admin receipt view — reuse the volunteer receipt screen
// Path can't traverse a route-group in a way lint resolves; use runtime require.
// eslint-disable-next-line import/no-unresolved
import ReceiptScreen from "../../(volunteer)/receipt/[id]";
export default ReceiptScreen;
