import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { Button, Card, CardBody, Input, Select, ProgressBar } from '@/components/ui';
import { ReferralShareBox } from '@/features/referrals/components/ReferralShareBox';
import { toast } from '@/store/uiStore';
import { queryKeys } from '@/api/queryClient';

const INTERESTS = ['Technology', 'Design', 'Business', 'Marketing', 'Engineering', 'Medicine', 'Law', 'Arts', 'Sports', 'Music', 'Content Creation', 'Entrepreneurship'];
const YEARS = Array.from({ length: 8 }, (_, i) => String(new Date().getFullYear() + 2 - i));

/** Three focused steps — profile, interests, then the referral link. */
export default function OnboardingPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({ college: '', course: '', graduationYear: '', city: '' });
  const [interests, setInterests] = useState<string[]>([]);

  const referral = useQuery({
    queryKey: queryKeys.referrals.me,
    queryFn: () => api.get<{ code: string; link: string }>('/referrals/me'),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch('/users/me', body),
  });

  const advance = useMutation({
    mutationFn: (nextStep: number) => api.post('/users/me/onboarding', { step: nextStep }),
    onSuccess: (_data, nextStep) => {
      if (user) setUser({ ...user, onboardingStep: nextStep });
      void client.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });

  const toggleInterest = (value: string) => {
    setInterests((prev) => (prev.includes(value) ? prev.filter((i) => i !== value) : prev.length < 6 ? [...prev, value] : prev));
  };

  const handleNext = async () => {
    if (step === 1) {
      await save.mutateAsync({
        college: profile.college || undefined,
        course: profile.course || undefined,
        graduationYear: profile.graduationYear ? Number(profile.graduationYear) : undefined,
        city: profile.city || undefined,
      });
      advance.mutate(1);
      setStep(2);
      return;
    }
    if (step === 2) {
      await save.mutateAsync({ interests });
      advance.mutate(2);
      setStep(3);
      return;
    }
    advance.mutate(3, {
      onSuccess: () => {
        toast.success('You are all set', 'Start sharing your link to earn your first points.');
        navigate('/dashboard', { replace: true });
      },
    });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--background)' }}>
      <div style={{ width: 'min(560px, 100%)' }} className="stack">
        <div>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <span className="small muted">Step {step} of 3</span>
            <button type="button" className="small muted" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => { advance.mutate(3); navigate('/dashboard'); }}>
              Skip for now
            </button>
          </div>
          <ProgressBar value={step} max={3} />
        </div>

        <Card>
          <CardBody className="stack" style={{ gap: 18 }}>
            {step === 1 ? (
              <>
                <div>
                  <h1 style={{ fontSize: 22 }}>Tell us about yourself</h1>
                  <p className="muted small" style={{ marginTop: 4 }}>This helps us recommend the campaigns most relevant to your campus.</p>
                </div>
                <Input label="College or university" placeholder="Osmania University" value={profile.college} onChange={(e) => setProfile({ ...profile, college: e.target.value })} />
                <Input label="Course" placeholder="B.Tech Computer Science" value={profile.course} onChange={(e) => setProfile({ ...profile, course: e.target.value })} />
                <div className="grid grid-2">
                  <Select
                    label="Graduation year"
                    placeholder="Select a year"
                    options={YEARS.map((y) => ({ value: y, label: y }))}
                    value={profile.graduationYear}
                    onChange={(e) => setProfile({ ...profile, graduationYear: e.target.value })}
                  />
                  <Input label="City" placeholder="Hyderabad" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div>
                  <h1 style={{ fontSize: 22 }}>What are you into?</h1>
                  <p className="muted small" style={{ marginTop: 4 }}>Pick up to six interests. We use these to surface campaigns you will actually want to post about.</p>
                </div>
                <div className="row wrap" style={{ gap: 8 }}>
                  {INTERESTS.map((interest) => {
                    const active = interests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        aria-pressed={active}
                        className={`chip chip--${active ? 'primary' : 'neutral'}`}
                        style={{ cursor: 'pointer', padding: '7px 14px', fontSize: 'var(--text-label)', border: active ? '1px solid var(--primary)' : undefined }}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
                <p className="small muted">{interests.length} of 6 selected</p>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div>
                  <h1 style={{ fontSize: 22 }}>Your referral link is ready</h1>
                  <p className="muted small" style={{ marginTop: 4 }}>
                    Share this link with classmates. When they join and get their posts approved, you earn at every level of your network.
                  </p>
                </div>
                {referral.data ? <ReferralShareBox code={referral.data.code} link={referral.data.link} /> : null}
              </>
            ) : null}

            <div className="row" style={{ justifyContent: 'space-between' }}>
              {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button> : <span />}
              <Button onClick={handleNext} loading={save.isPending || advance.isPending}>
                {step === 3 ? 'Go to dashboard' : 'Continue'}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
