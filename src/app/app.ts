import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Board } from './components/board/board';

@Component({
  selector: 'app-root',
  imports: [Board],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
