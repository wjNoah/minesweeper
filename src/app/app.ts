import { Component } from '@angular/core';
import { Board } from './components/board/board';

@Component({
  selector: 'app-root',
  imports: [Board],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
