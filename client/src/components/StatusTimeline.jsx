import { ORDER_STATUS_FLOW } from '../data/menuData';

/**
 * Visual progress for an order. Pure conditional rendering driven by the status prop.
 */
export default function StatusTimeline({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="banner error">
        This order was cancelled. Contact us if you would like to place it again.
      </div>
    );
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);

  return (
    <div className="chip-row" aria-label={`Order status: ${status}`}>
      {ORDER_STATUS_FLOW.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        return (
          <span
            key={step}
            className={`chip${state === 'done' ? ' accent' : ''}`}
            style={{
              opacity: state === 'todo' ? 0.45 : 1,
              fontWeight: state === 'current' ? 700 : 500,
            }}
          >
            {state === 'done' ? '✓ ' : state === 'current' ? '● ' : ''}
            {step}
          </span>
        );
      })}
    </div>
  );
}
