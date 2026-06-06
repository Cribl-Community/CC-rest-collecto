import { useNavigate } from 'react-router-dom';
import { useWizard } from '../context/WizardContext';
import { FormField } from '../components/FormField';

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 4 hours', value: '0 */4 * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at noon', value: '0 12 * * *' },
  { label: 'Weekly (Sunday midnight)', value: '0 0 * * 0' },
  { label: 'Custom', value: '' },
];

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo',
  'Asia/Singapore', 'Asia/Kolkata', 'Australia/Sydney',
];

// Maps a relative seconds offset to a human label
function relativeLabel(secs: number): string {
  const abs = Math.abs(secs);
  if (abs < 3600) return `${abs / 60}m`;
  if (abs % 3600 === 0) return `${abs / 3600}h`;
  return `${abs}s`;
}

const RELATIVE_PRESETS = [
  { label: 'Last 15 minutes', earliest: -900 },
  { label: 'Last 30 minutes', earliest: -1800 },
  { label: 'Last 1 hour', earliest: -3600 },
  { label: 'Last 4 hours', earliest: -14400 },
  { label: 'Last 6 hours', earliest: -21600 },
  { label: 'Last 24 hours', earliest: -86400 },
];

export function SchedulePage() {
  const { scheduleConfig, setScheduleConfig, collectorConfig } = useWizard();
  const navigate = useNavigate();

  if (!collectorConfig.collectUrl) {
    navigate('/configure');
    return null;
  }

  const cfg = scheduleConfig;

  function update<K extends keyof typeof cfg>(key: K, value: typeof cfg[K]) {
    setScheduleConfig({ ...cfg, [key]: value });
  }

  const isCustomCron = !CRON_PRESETS.slice(0, -1).some(p => p.value === cfg.cronSchedule);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Schedule</h2>
        <p className="page-subtitle">
          Configure when and how often this collector runs.
        </p>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Run Settings</h3>
        <div className="form-grid form-grid--2">
          <div className="form-field">
            <label className="form-label">Schedule</label>
            <div className="checkbox-label" style={{ marginBottom: '0.75rem' }}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={cfg.enabled}
                  onChange={e => update('enabled', e.target.checked)}
                />
                Enable scheduled runs
              </label>
            </div>
          </div>
          <FormField
            as="select"
            label="Timezone"
            value={cfg.tz}
            onChange={e => update('tz', e.target.value)}
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </FormField>
        </div>

        <div className="form-section-inner">
          <label className="form-label">Cron Schedule</label>
          <div className="cron-presets">
            {CRON_PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                className={`cron-preset-btn${
                  preset.value
                    ? cfg.cronSchedule === preset.value ? ' cron-preset-btn--active' : ''
                    : isCustomCron ? ' cron-preset-btn--active' : ''
                }`}
                onClick={() => {
                  if (preset.value) update('cronSchedule', preset.value);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="form-control cron-input"
            value={cfg.cronSchedule}
            onChange={e => update('cronSchedule', e.target.value)}
            placeholder="0 */4 * * *"
            aria-label="Cron schedule expression"
          />
          <p className="form-hint">
            Standard 5-field cron: minute hour day-of-month month day-of-week.{' '}
            <a href="https://crontab.guru/" target="_blank" rel="noopener noreferrer" className="inline-link">
              crontab.guru ↗
            </a>
          </p>
        </div>
      </div>

      {!collectorConfig.disableTimeFilter && (
        <div className="form-section">
          <h3 className="form-section-title">Time Range</h3>
          <FormField
            as="select"
            label="Time Range Type"
            value={cfg.timeRangeType}
            onChange={e => update('timeRangeType', e.target.value as 'relative' | 'absolute')}
          >
            <option value="relative">Relative</option>
            <option value="absolute">Absolute</option>
          </FormField>

          {cfg.timeRangeType === 'relative' && (
            <div className="form-section-inner">
              <label className="form-label">Lookback Window</label>
              <div className="cron-presets">
                {RELATIVE_PRESETS.map(p => (
                  <button
                    key={p.earliest}
                    type="button"
                    className={`cron-preset-btn${cfg.earliest === p.earliest ? ' cron-preset-btn--active' : ''}`}
                    onClick={() => update('earliest', p.earliest)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="form-grid form-grid--2">
                <FormField
                  label="Earliest (seconds, negative)"
                  type="number"
                  value={cfg.earliest}
                  onChange={e => update('earliest', Number(e.target.value))}
                  hint={`= ${relativeLabel(cfg.earliest)} ago`}
                />
                <FormField
                  label="Latest (0 = now)"
                  type="number"
                  value={cfg.latest}
                  onChange={e => update('latest', Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="form-section">
        <h3 className="form-section-title">Logging</h3>
        <FormField
          as="select"
          label="Log Level"
          value={cfg.logLevel}
          onChange={e => update('logLevel', e.target.value as typeof cfg.logLevel)}
        >
          <option value="info">Info</option>
          <option value="debug">Debug</option>
          <option value="error">Error</option>
        </FormField>
      </div>

      <div className="page-actions">
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/configure')}>
          ← Back
        </button>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/review')}>
          Review &amp; Export →
        </button>
      </div>
    </div>
  );
}
