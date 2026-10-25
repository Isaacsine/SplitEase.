import { Button } from "../../components/ui/Button";
import { paymentUnavailable } from "./payments.api";
export function AuthorisationForm() {
  return (
    <div className="notice">
      <p>{paymentUnavailable}</p>
      <Button disabled>Authorise with your bank</Button>
    </div>
  );
}
