const StateMachine = require('./StateMachine');

module.exports = function createPlugin(app) {
  const plugin = {};
  plugin.id = 'signalk-autostate';
  plugin.name = 'Auto-state';
  plugin.description = 'Automatically change navigation state based on vessel movement';

  let unsubscribes = [];
  let stateMachine = null;
  plugin.start = function start(options) {
    const subscription = {
      context: 'vessel.self',
      subscribe: [
        {
          path: 'navigation.position',
          period: 60000,
        },
        {
          path: 'navigation.anchor.position',
          period: 60000,
        },
        {
          path: 'navigation.speedOverGround',
          period: 60000,
        },
      ],
    };

    const currentStatus = {};
    function setState(state) {
      if (currentStatus.state === state) {
        return;
      }
      currentStatus.state = state;
      currentStatus.statePosition = currentStatus.position;
      app.setProvideStatus(`Detected state: ${state}`);
    }

    stateMachine = new StateMachine(options.position_minutes, options.underway_threshold);
    function handleValue(update) {
      setState(stateMachine.update(update));
    }

    app.subscriptionmanager.subscribe(
      subscription,
      unsubscribes,
      (subscriptionError) => {
        app.error(`Error:${subscriptionError}`);
      },
      (delta) => {
        delta.updates.forEach((u) => {
          u.values.forEach(handleValue);
        });
      },
    );
    app.setProvideStatus('Waiting for updates');
    const initialState = app.getSelfPath('navigation.state');
    if (initialState) {
      currentStatus.state = initialState;
      app.setProvideStatus(`Initial state: ${initialState}`);
    }
  };

  plugin.stop = function () {
    unsubscribes.forEach((f) => f());
    unsubscribes = [];
  };

  plugin.schema = {
    type: 'object',
    properties: {
      position_minutes: {
        type: 'integer',
        default: 10,
        title: 'How often to check whether vessel is under way (in minutes)',
      },
      underway_threshold: {
        type: 'integer',
        default: 100,
        title: 'Distance the vessel must move within the time to be considered under way (in meters)',
      },
    },
  };
};
