import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { RankingComponent } from './ranking/ranking.component';

import { MatButtonModule, MatCheckboxModule, MatChipsModule, MatSliderModule, MatSlideToggleModule, MatToolbarModule } from '@angular/material';

@NgModule({
  declarations: [
    AppComponent,
    RankingComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,

    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatToolbarModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
