import ProcessingOverlay from './ProcessingOverlay';

/** @deprecated Use skeleton layouts from `./skeleton` for data loading. ProcessingOverlay for actions. */
export default function LoadingOverlay(props: { message?: string }) {
  return <ProcessingOverlay {...props} />;
}
