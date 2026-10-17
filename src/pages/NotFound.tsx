import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { homeFor, useUser } from '@/lib/auth';

export default function NotFound() {
  const user = useUser();
  return (
    <div className="card">
      <EmptyState
        icon={<Compass />}
        title="This page doesn’t exist"
        message="The link may be outdated, or you may not have access to this area."
        action={
          <ButtonLink to={homeFor(user.role)} variant="primary">
            Back to dashboard
          </ButtonLink>
        }
      />
    </div>
  );
}
