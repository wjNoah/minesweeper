import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Plain text about the game, for players who are new to it and for search engines. */
@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrl: './about.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About {}
