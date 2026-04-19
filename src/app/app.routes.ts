import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    title: 'Live Dashboard · ViReAl',
  },
  {
    path: 'incidents',
    loadComponent: () =>
      import('./pages/incidents/incidents-list.component').then(
        (m) => m.IncidentsListComponent,
      ),
    title: 'Incidents · ViReAl',
  },
  {
    path: 'incidents/:id',
    loadComponent: () =>
      import('./pages/incidents/incident-detail.component').then(
        (m) => m.IncidentDetailComponent,
      ),
    title: 'Incident · ViReAl',
  },
  {
    path: 'venue-map',
    loadComponent: () =>
      import('./pages/venue-map/venue-map.page').then(
        (m) => m.VenueMapPageComponent,
      ),
    title: 'Venue Map · ViReAl',
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./pages/reports/reports-list.component').then(
        (m) => m.ReportsListComponent,
      ),
    title: 'Reports · ViReAl',
  },
  {
    path: 'reports/:id',
    loadComponent: () =>
      import('./pages/reports/report-detail.component').then(
        (m) => m.ReportDetailComponent,
      ),
    title: 'Report · ViReAl',
  },
  {
    path: 'escalate',
    loadComponent: () =>
      import('./pages/escalate/escalate.component').then(
        (m) => m.EscalateComponent,
      ),
    title: 'Escalate · ViReAl',
  },
  {
    path: 'staff',
    loadComponent: () =>
      import('./pages/staff/staff-list.component').then(
        (m) => m.StaffListComponent,
      ),
    title: 'Staff Roster · ViReAl',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.component').then(
        (m) => m.SettingsComponent,
      ),
    title: 'Settings · ViReAl',
  },
  { path: '**', redirectTo: '' },
];
