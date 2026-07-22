/* Defines client route composition so navigation, guards, and feature pages remain centralized. */
import { createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';

export const router = createBrowserRouter(routes);
