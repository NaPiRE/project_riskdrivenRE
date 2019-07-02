import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RankingComponent } from './ranking/ranking.component';

const routes: Routes = [
  { path: 'ranking', component: RankingComponent },
  { path: '', redirectTo: '/ranking', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
