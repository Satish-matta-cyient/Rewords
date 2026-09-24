import { Link } from 'react-router-dom';
import { StatusPage } from './LegalPages';
import { Button } from '@/components/ui';

export default function ForbiddenPage() {
  return (
    <StatusPage
      code="403"
      title="You do not have access to this area"
      body="This section is restricted to administrators. If you believe you should have access, ask a Super Administrator to review your role."
      action={
        <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
          <Link to="/"><Button>Back to my dashboard</Button></Link>
          <Link to="/support"><Button variant="secondary">Contact support</Button></Link>
        </div>
      }
    />
  );
}
