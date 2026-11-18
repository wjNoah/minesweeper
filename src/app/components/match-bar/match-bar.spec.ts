import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchMessage, MatchRules } from '../../models/match.model';
import { ConnectionService, ConnectionState, Role } from '../../services/connection.service';
import { MatchService } from '../../services/match.service';
import { MatchBar } from './match-bar';

class FakeConnection {
  readonly state = signal<ConnectionState>('connected');
  readonly role = signal<Role | null>('guest');
  private listener: ((message: MatchMessage) => void) | null = null;
  send(): void {}
  onMessage(listener: (message: MatchMessage) => void): () => void {
    this.listener = listener;
    return () => (this.listener = null);
  }
  deliver(message: MatchMessage): void {
    this.listener?.(message);
  }
  close(): void {}
}

describe('MatchBar', () => {
  let connection: FakeConnection;
  let fixture: ComponentFixture<MatchBar>;
  let host: HTMLElement;

  const rules = (mineRule: MatchRules['mineRule']): MatchRules => ({
    preset: 'beginner',
    noGuess: false,
    mineRule,
    penaltySeconds: 10,
  });

  function startRound(mineRule: MatchRules['mineRule']): void {
    connection.deliver({
      type: 'start',
      round: 1,
      rules: rules(mineRule),
      mines: [0, 2, 4, 6, 8, 72, 74, 76, 78, 80],
      start: { row: 4, col: 4 },
    });
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
  }

  const text = (selector: string) => host.querySelector(selector)?.textContent?.trim();
  const values = () => [...host.querySelectorAll('.value')].map((v) => v.textContent?.trim());

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    connection = new FakeConnection();
    TestBed.configureTestingModule({
      providers: [{ provide: ConnectionService, useValue: connection }],
    });
    TestBed.inject(MatchService);
    TestBed.tick();
    fixture = TestBed.createComponent(MatchBar);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => vi.useRealTimers());

  it('shows both players’ progress during a race', () => {
    startRound('defeat');
    connection.deliver({ type: 'progress', round: 1, revealed: 71, minesHit: 0 });
    fixture.detectChanges();

    const [me, opponent] = values();
    expect(Number(me?.replace('%', ''))).toBeGreaterThan(0);
    expect(Number(me?.replace('%', ''))).toBeLessThan(100);
    expect(opponent).toBe('100%'); // 71 safe cells on a Beginner board
  });

  it('never shows more than 100%, even if a modified opponent claims it', () => {
    startRound('defeat');
    connection.deliver({ type: 'progress', round: 1, revealed: 9999, minesHit: 0 });
    fixture.detectChanges();

    expect(values()[1]).toBe('100%');
    const bar = host.querySelectorAll('[role="progressbar"]')[1];
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });

  it('counts the opponent’s mines, with the right plural', () => {
    startRound('penalty');
    connection.deliver({ type: 'progress', round: 1, revealed: 10, minesHit: 1 });
    fixture.detectChanges();
    expect(host.querySelectorAll('.extra')[1].textContent).toContain('1 mine hit');

    connection.deliver({ type: 'progress', round: 1, revealed: 10, minesHit: 2 });
    fixture.detectChanges();
    expect(host.querySelectorAll('.extra')[1].textContent).toContain('2 mines hit');
  });

  it('names the rule of the round', () => {
    startRound('penalty');
    expect(text('.rule')).toBe('+10 s per mine');
  });

  it('shows the result and why, from my point of view', () => {
    startRound('penalty');
    connection.deliver({ type: 'finished', round: 1, finish: { kind: 'cleared', totalMs: 1000 } });
    vi.advanceTimersByTime(1400); // My clock passes their time, so I can no longer win.
    fixture.detectChanges();

    expect(text('.headline')).toBe('You lost');
    expect(text('.detail')).toContain('You: passed their time');
    expect(text('.detail')).toContain('Opponent: cleared in 0:01.0');
  });

  it('the guest asks for a rematch, the host would start it', () => {
    startRound('defeat');
    connection.deliver({ type: 'finished', round: 1, finish: { kind: 'exploded', totalMs: 1000 } });
    fixture.detectChanges();

    expect(text('.headline')).toBe('You won');
    expect(text('.actions .primary')).toBe('Ask for rematch');
    (host.querySelector('.actions .primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text('.actions .primary')).toBe('Waiting for host…');
    expect((host.querySelector('.actions .primary') as HTMLButtonElement).disabled).toBe(true);
  });
});
