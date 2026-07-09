import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  Car,
  CheckCircle2,
  Gauge,
  Mail,
  MapPin,
  Megaphone,
  PhoneCall,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Users,
  Wrench,
} from 'lucide-react';
import { DEFAULT_MODEL, listModels, streamChat } from '@/data/ollama';

export const Route = createFileRoute('/apps/car-dealer')({
  component: CarDealerDemo,
});

const vehicles = [
  {
    name: '2026 Azureline GT Hybrid',
    type: 'Certified hybrid sedan',
    price: '$36,880',
    payment: '$489/mo',
    priceValue: 36880,
    apr: 2.9,
    tag: 'Top lead magnet',
    color: 'from-teal-500 to-cyan-400',
    stats: ['41 mpg', '2.9% APR', '18 leads'],
  },
  {
    name: '2025 Summit Trail AWD',
    type: 'Family SUV',
    price: '$42,450',
    payment: '$559/mo',
    priceValue: 42450,
    apr: 4.4,
    tag: 'Weekend feature',
    color: 'from-amber-400 to-orange-500',
    stats: ['7 seats', '$2k bonus', '12 demos'],
  },
  {
    name: '2024 Metro Spark EV',
    type: 'Urban electric hatch',
    price: '$28,990',
    payment: '$379/mo',
    priceValue: 28990,
    apr: 1.9,
    tag: 'Fast mover',
    color: 'from-sky-500 to-blue-600',
    stats: ['286 mi', 'Lease deal', '9 holds'],
  },
];

const leads = [
  {
    name: 'Priya Shah',
    intent: 'EV hatchback',
    note: 'Ready today',
    heat: 'Hot',
    budget: '$400/mo',
    trade: '2018 Civic, positive equity',
    urgency: 'Needs delivery before Friday',
    channel: 'SMS',
  },
  {
    name: 'Marcus Lee',
    intent: 'Trade-in SUV',
    note: 'Needs appraisal',
    heat: 'Warm',
    budget: '$575/mo',
    trade: '2020 RAV4, 61k miles',
    urgency: 'Shopping this weekend',
    channel: 'Email',
  },
  {
    name: 'Elena Torres',
    intent: 'Hybrid sedan',
    note: 'Finance precheck',
    heat: 'Hot',
    budget: '$500/mo',
    trade: 'Lease ending in 22 days',
    urgency: 'Wants low fuel cost',
    channel: 'Phone',
  },
  {
    name: 'David Nguyen',
    intent: 'Service upgrade',
    note: 'Lease ending',
    heat: 'Warm',
    budget: '$450/mo',
    trade: 'Current service customer',
    urgency: 'Open to certified pre-owned',
    channel: 'Email',
  },
];

const serviceSlots = [
  ['8:30', 'Brake inspection', 'CX-5', 'Confirmed'],
  ['10:15', 'EV battery check', 'Metro Spark', 'VIP'],
  ['13:00', 'Detail + ceramic', 'Summit Trail', 'Upsell'],
];

function CarDealerDemo() {
  return (
    <div className="min-h-[calc(100vh-7rem)] rounded-[2rem] bg-[#f3f7f4] p-3 text-slate-950 shadow-sm ring-1 ring-emerald-950/10 sm:p-4">
      <div className="overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,#fbf7ed_0%,#e7f5ef_45%,#d9eef1_100%)] ring-1 ring-white/80">
        <section className="relative grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-9">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-700/30 to-transparent" />
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/15 bg-white/70 px-3 py-1 text-xs font-semibold text-emerald-950 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
              Dealer command center
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
                Move more cars with a sharper showroom flow.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
                A live-style dealer demo for inventory merchandising, lead response,
                service retention, and locally generated campaign copy.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Metric icon={BadgeDollarSign} label="Gross pipeline" value="$842k" delta="+18%" />
              <Metric icon={Users} label="Active buyers" value="146" delta="32 hot" />
              <Metric icon={Gauge} label="Avg response" value="4m" delta="-41%" />
            </div>
          </div>

          <div className="relative min-h-[380px] rounded-[1.35rem] bg-slate-950 p-4 text-white shadow-2xl shadow-emerald-950/20 ring-1 ring-white/15">
            <div className="absolute inset-0 rounded-[1.35rem] bg-[radial-gradient(circle_at_25%_15%,rgba(45,212,191,0.32),transparent_34%),radial-gradient(circle_at_78%_25%,rgba(251,191,36,0.20),transparent_30%)]" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-teal-200">Today</p>
                <h2 className="mt-1 text-2xl font-bold">Northgate Auto</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Car className="h-5 w-5 text-teal-200" />
              </div>
            </div>

            <div className="relative mt-7 rounded-2xl bg-white p-4 text-slate-950 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Featured vehicle</p>
                  <h3 className="mt-1 text-2xl font-black">Azureline GT Hybrid</h3>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  18 leads
                </span>
              </div>
              <div className="mt-5 h-32 rounded-2xl bg-[linear-gradient(135deg,#0f766e,#22d3ee)] p-4 shadow-inner">
                <div className="relative mx-auto mt-8 h-14 max-w-[280px] rounded-[2rem] bg-slate-900 shadow-2xl">
                  <div className="absolute -top-8 left-12 h-12 w-40 rounded-t-[3rem] bg-slate-800" />
                  <div className="absolute left-5 top-10 h-9 w-9 rounded-full border-[7px] border-slate-700 bg-slate-200" />
                  <div className="absolute right-5 top-10 h-9 w-9 rounded-full border-[7px] border-slate-700 bg-slate-200" />
                  <div className="absolute right-8 top-3 h-2 w-8 rounded-full bg-cyan-200" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <MiniStat label="Offer" value="2.9% APR" />
                <MiniStat label="Payment" value="$489/mo" />
                <MiniStat label="Turn" value="11 days" />
              </div>
            </div>

            <div className="relative mt-4 grid grid-cols-2 gap-3">
              <DarkTile icon={PhoneCall} label="Calls booked" value="27" />
              <DarkTile icon={CalendarClock} label="Test drives" value="14" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 px-5 pb-6 sm:px-8 lg:grid-cols-[1.35fr_0.65fr] lg:px-10 lg:pb-10">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-800">Inventory spotlight</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Campaign-ready units</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-900/10">
                <Search className="h-4 w-4 text-emerald-700" />
                42 matched buyers
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.name} vehicle={vehicle} />
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Lead queue" icon={Users} action="Prioritized">
                <div className="space-y-3">
                  {leads.map((lead) => (
                    <div key={lead.name} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-900/5">
                      <div>
                        <p className="font-bold text-slate-950">{lead.name}</p>
                        <p className="text-sm text-slate-600">{lead.intent} · {lead.note}</p>
                      </div>
                      <span className={lead.heat === 'Hot' ? 'rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700' : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800'}>
                        {lead.heat}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Service lane" icon={Wrench} action="Today">
                <div className="space-y-3">
                  {serviceSlots.map(([time, job, vehicle, status]) => (
                    <div key={time} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-900/5">
                      <span className="font-black text-emerald-800">{time}</span>
                      <div>
                        <p className="font-bold text-slate-950">{job}</p>
                        <p className="text-sm text-slate-600">{vehicle}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-900/10">
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <aside className="space-y-4">
            <DealDesk />

            <Panel title="Trust signals" icon={ShieldCheck} action="Showroom">
              <div className="grid gap-3">
                <Trust label="Finance approvals" value="91%" />
                <Trust label="Review rating" value="4.8" />
                <Trust label="Same-day delivery" value="23" />
              </div>
            </Panel>
          </aside>
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className="rounded-2xl bg-white/75 p-4 shadow-sm ring-1 ring-slate-900/10 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-emerald-700" />
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{delta}</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-100 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}

function DarkTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
      <Icon className="h-5 w-5 text-teal-200" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: (typeof vehicles)[number] }) {
  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10">
      <div className={`h-28 bg-gradient-to-br ${vehicle.color} p-4`}>
        <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-black text-slate-900 shadow-sm">
          {vehicle.tag}
        </span>
      </div>
      <div className="p-4">
        <p className="text-sm font-semibold text-slate-500">{vehicle.type}</p>
        <h3 className="mt-1 min-h-14 text-xl font-black leading-tight text-slate-950">{vehicle.name}</h3>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-black text-slate-950">{vehicle.price}</p>
            <p className="text-sm font-semibold text-emerald-700">{vehicle.payment}</p>
          </div>
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {vehicle.stats.map((stat) => (
            <span key={stat} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              {stat}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function DealDesk() {
  const [leadIndex, setLeadIndex] = useState(0);
  const [vehicleIndex, setVehicleIndex] = useState(0);
  const [downPayment, setDownPayment] = useState(3500);
  const [term, setTerm] = useState(72);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [models, setModels] = useState<string[]>([]);
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lead = leads[leadIndex];
  const vehicle = vehicles[vehicleIndex];
  const monthlyPayment = estimatePayment(vehicle.priceValue, downPayment, vehicle.apr, term);
  const monthlyDelta = parseBudget(lead.budget) - monthlyPayment;

  useEffect(() => {
    listModels().then((available) => {
      setModels(available);
      const preferred = available.includes('phi3.5:3.8b')
        ? 'phi3.5:3.8b'
        : available[0];
      if (preferred && (model === DEFAULT_MODEL || !available.includes(model))) {
        setModel(preferred);
      }
    });
  }, [model]);

  function stop() {
    abortRef.current?.abort();
    setBusy(false);
  }

  async function generatePlan() {
    if (busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setOutput('');
    setError(null);
    setBusy(true);
    try {
      await streamChat(
        [
          {
            role: 'system',
            content:
              'You are an expert automotive retail sales manager. Create concise, compliant, practical dealership follow-up. Use only the buyer, vehicle, payment, trade, and urgency facts provided. Repeat the selected vehicle name exactly as given. Do not invent rebates, approvals, warranties, inventory, or alternate vehicles.',
          },
          {
            role: 'user',
            content: `Create a deal desk recommendation for this buyer.\nBuyer: ${lead.name}\nIntent: ${lead.intent}\nStatus: ${lead.note}\nHeat: ${lead.heat}\nBudget: ${lead.budget}\nTrade context: ${lead.trade}\nUrgency: ${lead.urgency}\nPreferred channel: ${lead.channel}\nVehicle: ${vehicle.name}\nVehicle type: ${vehicle.type}\nPrice: ${vehicle.price}\nOffer APR: ${vehicle.apr}%\nDown payment: $${downPayment}\nTerm: ${term} months\nEstimated payment: $${monthlyPayment}/mo\n\nReturn exactly four sections: 1) Best next action, 2) Buyer-specific pitch, 3) One ${lead.channel} message under 75 words, 4) Manager note with any risk or objection.`,
          },
        ],
        {
          model,
          signal: controller.signal,
          onToken: (token) => setOutput((prev) => prev + token),
        },
      );
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <Panel title="Live deal desk" icon={Megaphone} action="Local model">
      <div className="rounded-2xl bg-slate-950 p-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-200">
            <Sparkles className="h-4 w-4" />
            Buyer match simulator
          </div>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="max-w-[155px] rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs font-bold text-white outline-none"
            aria-label="Model"
          >
            {(models.length ? models : [DEFAULT_MODEL]).map((availableModel) => (
              <option key={availableModel} value={availableModel} className="text-slate-950">
                {availableModel}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-semibold text-slate-300">
            Lead
            <select
              value={leadIndex}
              onChange={(event) => setLeadIndex(Number(event.target.value))}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 font-bold text-white outline-none"
            >
              {leads.map((candidate, index) => (
                <option key={candidate.name} value={index} className="text-slate-950">
                  {candidate.name} · {candidate.intent}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-slate-300">
            Vehicle
            <select
              value={vehicleIndex}
              onChange={(event) => setVehicleIndex(Number(event.target.value))}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 font-bold text-white outline-none"
            >
              {vehicles.map((candidate, index) => (
                <option key={candidate.name} value={index} className="text-slate-950">
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
          <div className="flex items-center gap-2 text-sm font-bold text-teal-100">
            <SlidersHorizontal className="h-4 w-4" />
            Payment fit
          </div>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Down payment · ${downPayment.toLocaleString()}
            <input
              type="range"
              min="0"
              max="9000"
              step="500"
              value={downPayment}
              onChange={(event) => setDownPayment(Number(event.target.value))}
              className="accent-teal-300"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[60, 72, 84].map((months) => (
              <button
                key={months}
                onClick={() => setTerm(months)}
                className={months === term ? 'rounded-xl bg-teal-300 px-3 py-2 text-sm font-black text-slate-950' : 'rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white ring-1 ring-white/10'}
              >
                {months} mo
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniStatDark label="Estimate" value={`$${monthlyPayment}/mo`} />
            <MiniStatDark label="Budget gap" value={monthlyDelta >= 0 ? `+$${monthlyDelta}` : `-$${Math.abs(monthlyDelta)}`} />
          </div>
        </div>

        <button
          onClick={busy ? stop : generatePlan}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal-300 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-teal-950/20 disabled:opacity-70"
        >
          {busy ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {busy ? 'Stop generation' : 'Generate deal plan'}
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <Signal icon={Mail} label="Preferred channel" value={lead.channel} />
        <Signal icon={MapPin} label="Trade context" value={lead.trade} />
        <Signal icon={Star} label="Urgency" value={lead.urgency} />
      </div>

      {(output || error) && (
        <div className="mt-4 max-h-[360px] overflow-auto rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-800 ring-1 ring-slate-900/5">
          {error ? <p className="font-bold text-rose-700">{error}</p> : <pre className="whitespace-pre-wrap font-sans">{output}</pre>}
        </div>
      )}
    </Panel>
  );
}

function estimatePayment(price: number, down: number, apr: number, months: number): number {
  const principal = Math.max(0, price - down);
  const monthlyRate = apr / 100 / 12;
  if (!monthlyRate) return Math.round(principal / months);
  return Math.round((principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months));
}

function parseBudget(value: string): number {
  return Number(value.replace(/[^0-9]/g, '')) || 0;
}

function MiniStatDark({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-white/10">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-900/10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{action}</span>
      </div>
      {children}
    </section>
  );
}

function Signal({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-900/5">
      <Icon className="h-4 w-4 text-emerald-700" />
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-sm font-black text-slate-950">{value}</p>
      </div>
    </div>
  );
}

function Trust({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-900/5">
      <span className="font-bold text-slate-700">{label}</span>
      <span className="text-2xl font-black text-slate-950">{value}</span>
    </div>
  );
}