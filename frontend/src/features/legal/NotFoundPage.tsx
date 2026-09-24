import { Link } from 'react-router-dom';
import { StatusPage } from './LegalPages';
import { Button } from '@/components/ui';

export default function NotFoundPage() {
  return (
    <StatusPage
      code="404"
      title="We could not find that page"
      body="The link may be out of date, or the item may have been removed. Head back and try again from the dashboard."
      action={<Link to="/"><Button>Back to dashboard</Button></Link>}
    />
  );
}
