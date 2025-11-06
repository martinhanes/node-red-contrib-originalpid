module.exports = function (RED) {
    function OriginalPIDNode(config) {
        RED.nodes.createNode(this, config);
        const fileStoreName = 'file';
        const node = this;

        node.kp = parseFloat(config.Kp) || 1.0;
        node.ki = parseFloat(config.Ki) || 0.0;
        node.kd = parseFloat(config.Kd) || 0.0;
        node.sampleTime = parseFloat(config.sampleTime) || 100; // ms
        node.setpoint = parseFloat(config.setpoint) || 0;
        node.filteringFactor = parseFloat(config.filteringFactor) || 0;
        node.outMin = parseFloat(config.outMin) || 0;
        node.outMax = parseFloat(config.outMax) || 1;

        // Internal state
        node.outputSum = 0;
        node.lastInput = 0;
        node.lastTime = Date.now();

        node.SetTunings = function (Kp, Ki, Kd) {
            const sampleTimeSec = node.sampleTime / 1000.0;
            node.kp = Kp;
            node.ki = Ki * sampleTimeSec;
            node.kd = Kd / sampleTimeSec;
        };

        node.SetTunings(node.kp, node.ki, node.kd);


        let storeName = fileStoreName; // try to use file store if user configured
        try {
            const saved = node.context().get('pidState', storeName);
            if (saved) {
                node.outputSum = saved.outputSum;
                node.lastInput = saved.lastInput;
                node.lastTime = saved.lastTime;
                node.log(`state loaded from '${storeName}' store`);
            }
        } catch (err) {
            // fallback to default store
            const saved = node.context().get('pidState');
            storeName = 'default';
            if (saved) {
                node.outputSum = saved.outputSum;
                node.lastInput = saved.lastInput;
                node.lastTime = saved.lastTime;
                node.log(`state loaded from default store`);
            } else {
                node.warn("no saved state found, starting fresh");
            }
        }

        node.on('input', function (msg) {

            if (msg.hasOwnProperty("setpoint")) {
                const newSetpoint = parseFloat(msg.setpoint);
                if (!isNaN(newSetpoint)) {
                    node.setpoint = newSetpoint;
                    node.log(`Setpoint updated to: ${node.setpoint}`);
                    node.status({fill: "green", shape: "dot", text: `setpoint set to ${node.setpoint}`});

                    setTimeout(() => {
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: 'waiting for next input'
                        });
                    }, 3000);
                } else {
                    node.warn(`Invalid setpoint value received: ${msg.setpoint}`);
                }
            }

            // If message requests a restart/reset
            if (msg.reset) {
                // Reset internal state
                node.outputSum = 0;
                node.lastInput = 0;
                node.lastTime = Date.now();

                // Save cleared state to context
                node.context().set('pidState', {
                    outputSum: node.outputSum,
                    lastInput: node.lastInput,
                    lastTime: node.lastTime
                }, store);

                //log and show status message
                node.log(`PID node [${node.id}] state reset via input message`);
                node.status({fill: "yellow", shape: "dot", text: "State was reset"});

                setTimeout(() => {
                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: 'waiting for the next input'
                    });
                }, 3000);


                return; // skip normal PID calculation
            }


            const input = parseFloat(msg.payload);
            if (isNaN(input)) {
                node.error("Invalid input (not a number)", msg);
                return;
            }

            const now = Date.now();
            const timeChange = now - node.lastTime;
            if (timeChange < node.sampleTime) return; // too soon


            //filtering
            const alpha = 0.5; //replace by node.filteringFactor
            // node.prevInputFiltered = node.prevInputFiltered ?? input; // input when first run
            // when filteringFactor == 0, the input is unfiltered
            // Note: node.lastInput is already filtered. For first run, just use input.
            // if
            // let lastInputFiltered = node.lastInput ?? input;
            let filteredInput = alpha * (node.lastInput ?? input) + (1 - alpha) * input;


            const error = node.setpoint - filteredInput;
            const dInput = filteredInput - node.lastInput;

            // Integral
            node.outputSum += (node.ki * error);
            // Anti-windup
            if (node.outputSum > node.outMax) node.outputSum = node.outMax;
            else if (node.outputSum < node.outMin) node.outputSum = node.outMin;


            // Calculating output
            // note: Kd is on input, not error, to prevent “derivative kick” when the setpoint changes.
            let output = node.kp * error + node.outputSum - node.kd * filteredInput;
            if (output > node.outMax) output = node.outMax;
            else if (output < node.outMin) output = node.outMin;


            node.lastInput = filteredInput;
            node.lastTime = now;

            // Payload forming
            msg.payload = output;
            msg.pid = {
                setpoint: node.setpoint,
                input,
                error,
                P: node.kp * error,
                I: node.outputSum,
                D: -node.kd * dInput,
                output,
                filteredInput,
                outMin: node.outMin,
                outMax: node.outMax
            };
            node.send(msg);

            node.status({fill: "green", shape: "dot", text: `out=${output.toFixed(2)}, err=${error.toFixed(2)}`});

            node.context().set('pidState', {
                outputSum: node.outputSum,
                lastInput: node.lastInput,
                lastTime: node.lastTime
            }, storeName);


        });
    }

    RED.nodes.registerType("originalpid", OriginalPIDNode);
};

