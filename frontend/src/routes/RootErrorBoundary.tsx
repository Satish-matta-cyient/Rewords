import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router-dom';
import { Button, Card, CardBody } from '@/components/ui';

export function RootErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.';

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
      <Card style={{ maxWidth: 480, width: '100%' }}>
        <CardBody className="stack">
          <h1 style={{ fontSize: 22 }}>This page could not be displayed</h1>
          <p className="muted small">{message}</p>
          <div className="row">
            <Button onClick={() => navigate('/')}>Back to home</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
